import { createClient } from "@supabase/supabase-js";
import { buildSearch, fetchAllOpenFDA } from "../_shared/fetchOpenFDA.js";
import { normalizeRecall } from "../_shared/normalizeOpenFDA.js";

const WRITE_CHUNK = 200; // rows per database request
const OVERLAP_DAYS = 14; // re-check this many days before the newest data we have

const SOURCES: Record<string, string> = {
  food: "openfda_food",
  drug: "openfda_drug",
  device: "openfda_device",
};

const corsHeaders = {
  // Wildcard required because this endpoint serves both the React app and external tools
  "Access-Control-Allow-Origin": "*",
  // `x-import-secret` authenticates requests from external tools like Retool
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-import-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** Date -> "YYYYMMDD" */
function toYmd(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

/** "2026-11-02" or a timestamp -> the date N days earlier */
function daysBefore(dateOrTimestamp: string, days: number) {
  const date = new Date(`${dateOrTimestamp.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  // Service role bypasses RLS. SUPABASE_URL and the key are provided automatically.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  /**
   * Authenticates the import request via one of two methods:
   * 1. An authenticated admin session from the client app.
   * 2. A valid `IMPORT_SECRET` API key passed in the request headers.
   */

  // Retrieve the expected secret from Supabase Edge Function environment variables.
  const importSecret = Deno.env.get("IMPORT_SECRET");

  // Read the custom API secret from the incoming request header.
  const providedSecret = req.headers.get("x-import-secret");

  // Validate the API secret (both values must exist and match).
  const hasValidImportSecret = !!importSecret &&
    !!providedSecret &&
    providedSecret === importSecret;

  // If no valid API secret is provided, fall back to standard user authentication
  // and verify that the caller has admin privileges.
  if (!hasValidImportSecret) {
    // Only admins may run an import
    const token = (req.headers.get("Authorization") ?? "").replace(
      /^Bearer\s+/i,
      "",
    );
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) {
      return json({ error: "Log in as an admin to run an import." }, 401);
    }

    const { data: caller } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (caller?.role !== "admin") {
      return json({ error: "Only admins can run an import." }, 403);
    }
  }

  // Options (all optional):
  // { productType: "food", from: "20250101", to: "20261231", status: "Ongoing", maxRecords: 5000, force: false }
  // Without from/to/status, the function runs an update import.
  const body = await req.json().catch(() => ({}));
  const productType: string = body.productType ?? "food";
  const source = SOURCES[productType];
  if (!source) {
    return json({ error: "productType must be food, drug, or device" }, 400);
  }
  const maxRecords = Math.min(Number(body.maxRecords ?? 5000), 26000);
  const force = body.force === true;

  // Don't start while another import is running (runs stuck for over 10 minutes are ignored)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: running } = await supabase
    .from("sync_runs")
    .select("id")
    .eq("source", source)
    .eq("status", "running")
    .gte("started_at", tenMinutesAgo)
    .limit(1);
  if (running && running.length > 0) {
    return json({
      error: "An import is already running. Try again in a few minutes.",
    }, 409);
  }

  // Decide what to fetch
  const searches: string[] = [];
  if (body.from || body.to || body.status) {
    // Explicit range, like the first bulk import
    searches.push(
      buildSearch({ status: body.status, from: body.from, to: body.to }),
    );
  } else {
    // Update import
    const { data: newest } = await supabase
      .from("recalls")
      .select("report_date")
      .eq("source", source)
      .not("report_date", "is", null)
      .order("report_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: lastSuccess } = await supabase
      .from("sync_runs")
      .select("started_at")
      .eq("source", source)
      .eq("status", "success")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // New reports since shortly before our newest recall
    searches.push(
      buildSearch({
        from: newest?.report_date
          ? toYmd(daysBefore(newest.report_date, OVERLAP_DAYS))
          : undefined,
      }),
    );

    // Recalls the FDA closed since the last import (catches older recalls that changed)
    if (lastSuccess?.started_at) {
      searches.push(
        buildSearch({
          dateField: "termination_date",
          from: toYmd(daysBefore(lastSuccess.started_at, OVERLAP_DAYS)),
        }),
      );
    }
  }

  // Create the sync run first so recall_changes can reference it
  const { data: run, error: runError } = await supabase
    .from("sync_runs")
    .insert({ source })
    .select("id, started_at")
    .single();
  if (runError) {
    return json(
      { error: `Could not start the import: ${runError.message}` },
      500,
    );
  }

  const runStartedAt = new Date(run.started_at);
  const syncedAt = new Date().toISOString();
  const stats = {
    fetched: 0,
    inserted: 0,
    updated: 0,
    rejected: 0,
    changes: 0,
  };
  const rejectedSamples: string[] = [];
  let fdaLastUpdated: string | null = null;

  async function finish(status: string, errorMessage: string | null = null) {
    await supabase
      .from("sync_runs")
      .update({
        status,
        fda_last_updated: fdaLastUpdated,
        records_fetched: stats.fetched,
        records_inserted: stats.inserted,
        records_updated: stats.updated,
        error_message: errorMessage,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
  }

  async function savePage(results: any[]) {
    stats.fetched += results.length;

    // Normalize, and dedupe by recall_number (an upsert batch can't contain the same key twice)
    const byNumber = new Map<string, any>();
    for (const raw of results) {
      const normalized: any = normalizeRecall(raw, {
        syncRunId: run.id,
        syncedAt,
      });
      if (normalized.error) {
        stats.rejected++;
        if (rejectedSamples.length < 10) rejectedSamples.push(normalized.error);
        continue;
      }
      byNumber.set(normalized.recall.recall_number, normalized);
    }

    for (const group of chunk([...byNumber.values()], WRITE_CHUNK)) {
      // Inserts fire the matching trigger; updates fire the change-logging and alert triggers
      const { data: saved, error: upsertError } = await supabase
        .from("recalls")
        .upsert(group.map((g) => g.recall), {
          onConflict: "source,recall_number",
        })
        .select("id, recall_number, first_seen_at");
      if (upsertError) {
        throw new Error(`Recall upsert failed: ${upsertError.message}`);
      }

      const rows = saved ?? [];
      const idByNumber = new Map(rows.map((r) => [r.recall_number, r.id]));
      for (const r of rows) {
        if (new Date(r.first_seen_at) >= runStartedAt) stats.inserted++;
        else stats.updated++;
      }

      // Replace distribution states for these recalls
      const ids = rows.map((r) => r.id);
      const { error: deleteError } = await supabase
        .from("recall_distribution_states")
        .delete()
        .in("recall_id", ids);
      if (deleteError) {
        throw new Error(`State cleanup failed: ${deleteError.message}`);
      }

      const stateRows = group.flatMap((g) =>
        g.states.map((state_code: string) => ({
          recall_id: idByNumber.get(g.recall.recall_number),
          state_code,
        }))
      );
      if (stateRows.length > 0) {
        const { error: stateError } = await supabase.from(
          "recall_distribution_states",
        ).insert(stateRows);
        if (stateError) {
          throw new Error(`State insert failed: ${stateError.message}`);
        }
      }
    }
  }

  try {
    for (const search of searches) {
      for await (
        const page of fetchAllOpenFDA({ productType, search, maxRecords })
      ) {
        // On the first page, stop if the FDA hasn't published anything new
        if (fdaLastUpdated === null) {
          fdaLastUpdated = page.meta?.last_updated ?? null;
          if (!force && fdaLastUpdated) {
            const { data: previous } = await supabase
              .from("sync_runs")
              .select("id")
              .eq("source", source)
              .eq("status", "success")
              .eq("fda_last_updated", fdaLastUpdated)
              .limit(1);
            if (previous && previous.length > 0) {
              await finish("skipped");
              return json({ runId: run.id, status: "skipped", fdaLastUpdated });
            }
          }
        }
        await savePage(page.results);
      }
    }

    // How many recall fields changed in this run (status, dates, text)
    const { count } = await supabase
      .from("recall_changes")
      .select("id", { count: "exact", head: true })
      .eq("sync_run_id", run.id);
    stats.changes = count ?? 0;

    await finish("success");
    return json({
      runId: run.id,
      status: "success",
      fdaLastUpdated,
      ...stats,
      rejectedSamples,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finish("failed", message);
    return json(
      { runId: run.id, status: "failed", error: message, ...stats },
      500,
    );
  }
});
