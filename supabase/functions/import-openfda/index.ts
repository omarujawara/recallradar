import { createClient } from "@supabase/supabase-js";
import { buildSearch, fetchAllOpenFDA } from "../_shared/fetchOpenFDA.js";
import { normalizeRecall } from "../_shared/normalizeOpenFDA.js";

const WRITE_CHUNK = 200; // rows per database request

const SOURCES: Record<string, string> = {
  food: "openfda_food",
  drug: "openfda_drug",
  device: "openfda_device",
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  // Only callers who know IMPORT_SECRET can run the import
  // const secret = Deno.env.get("IMPORT_SECRET");
  // if (!secret || req.headers.get("x-import-secret") !== secret) {
  //   return json({ error: "Unauthorized" }, 401);
  // }

  // Options (all optional):
  // { productType: "food", from: "20250101", to: "20261231", status: "Ongoing", maxRecords: 5000, force: false }
  const body = await req.json().catch(() => ({}));
  const productType: string = body.productType ?? "food";
  const source = SOURCES[productType];
  if (!source) {
    return json({ error: "productType must be food, drug, or device" }, 400);
  }

  const search = buildSearch({
    status: body.status,
    from: body.from,
    to: body.to,
  });
  const maxRecords = Math.min(Number(body.maxRecords ?? 5000), 26000);
  const force = body.force === true;

  // Service role bypasses RLS. SUPABASE_URL and the key are provided automatically.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 1. Create the sync run first so recall_changes can reference it
  const { data: run, error: runError } = await supabase
    .from("sync_runs")
    .insert({ source })
    .select("id, started_at")
    .single();
  if (runError) {
    return json(
      { error: `Could not start sync run: ${runError.message}` },
      500,
    );
  }

  const runStartedAt = new Date(run.started_at);
  const syncedAt = new Date().toISOString();
  const stats = { fetched: 0, inserted: 0, updated: 0, rejected: 0 };
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

  try {
    for await (
      const page of fetchAllOpenFDA({
        productType,
        search,
        maxRecords,
        apiKey: Deno.env.get("OPENFDA_API_KEY"),
      })
    ) {
      // 2. On the first page, skip if FDA hasn't published anything new
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

      stats.fetched += page.results.length;

      // 3. Normalize, and dedupe by recall_number within the page
      //    (an upsert batch can't contain the same key twice)
      const byNumber = new Map<string, any>();
      for (const raw of page.results) {
        const normalized: any = normalizeRecall(raw, {
          syncRunId: run.id,
          syncedAt,
        });
        if (normalized.error) {
          stats.rejected++;
          if (rejectedSamples.length < 10) {
            rejectedSamples.push(normalized.error);
          }
          continue;
        }
        byNumber.set(normalized.recall.recall_number, normalized);
      }

      for (const group of chunk([...byNumber.values()], WRITE_CHUNK)) {
        // 4. Upsert recalls. Existing rows are updated, which fires the change-logging trigger.
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

        // New rows were first seen during this run
        for (const r of rows) {
          if (new Date(r.first_seen_at) >= runStartedAt) stats.inserted++;
          else stats.updated++;
        }

        // 5. Replace distribution states for these recalls
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
          const { error: stateError } = await supabase
            .from("recall_distribution_states")
            .insert(stateRows);
          if (stateError) {
            throw new Error(`State insert failed: ${stateError.message}`);
          }
        }
      }
    }

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
