import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import Metric from '@/components/reports/Metric';
import ReportSection from '@/components/reports/ReportSection';
import { useAdminReport } from '@/hooks/useAdminReport';
import { RANGE_PRESETS, WATCH_ITEM_TYPES } from '@/constants';
import { formatPeriod, rangeForPreset, toIsoDate } from '@/utils/dateRanges';
import { formatDate } from '@/utils/format';

const TREND_CONFIG = {
  class_i: { label: 'Serious (Class I)', color: 'var(--destructive)' },
  class_ii: { label: 'Moderate (Class II)', color: 'var(--chart-2)' },
  class_iii: { label: 'Low (Class III)', color: 'var(--chart-3)' },
  unclassified: { label: 'Not yet rated', color: 'var(--muted-foreground)' },
};

const CLASS_LABELS = {
  'Class I': 'Serious (Class I)',
  'Class II': 'Moderate (Class II)',
  'Class III': 'Low (Class III)',
  'Not Yet Classified': 'Not yet rated',
};

function EmptyChart({ children = 'Nothing to show for this period.' }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** Ranked list as horizontal bars, with the value printed at the end of each bar */
function HorizontalBars({ data, labelKey, valueKey, valueLabel, color = 'var(--chart-1)', labelWidth = 150 }) {
  if (data.length === 0 || data.every((row) => row[valueKey] === 0)) return <EmptyChart />;

  const config = { [valueKey]: { label: valueLabel, color } };
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: data.length * 36 + 8 }}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 48 }} accessibilityLayer>
        <XAxis type="number" dataKey={valueKey} hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey={labelKey}
          width={labelWidth}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey={valueKey} fill={`var(--color-${valueKey})`} radius={4}>
          <LabelList dataKey={valueKey} position="right" className="fill-foreground" fontSize={12} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** One series over time as vertical bars */
function PeriodBars({ data, valueKey, valueLabel, color }) {
  if (data.every((row) => row[valueKey] === 0)) return <EmptyChart />;

  const config = { [valueKey]: { label: valueLabel, color } };
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey={valueKey} fill={`var(--color-${valueKey})`} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export default function Reports() {
  const [preset, setPreset] = useState('12m');
  const [custom, setCustom] = useState(() => rangeForPreset('90d'));

  const range = preset === 'custom' ? custom : rangeForPreset(preset);
  const invalid = !range.from || !range.to || range.from > range.to;
  const { report, loading, error } = useAdminReport(invalid ? {} : range);

  const bucket = report?.range.bucket;
  const trend = useMemo(
    () => (report?.trend ?? []).map((row) => ({ ...row, label: formatPeriod(row.period_start, bucket) })),
    [report, bucket],
  );
  const activity = useMemo(
    () => (report?.activity_trend ?? []).map((row) => ({ ...row, label: formatPeriod(row.period_start, bucket) })),
    [report, bucket],
  );
  const watchTypes = useMemo(
    () =>
      (report?.watch_types ?? []).map((row) => ({
        ...row,
        label: WATCH_ITEM_TYPES.find((type) => type.value === row.item_type)?.label ?? row.item_type,
      })),
    [report],
  );

  const previousStartsBeforeData =
    report?.data_range.first && report.range.previous_from < report.data_range.first;
  const trendIsEmpty = trend.every((row) => row.class_i + row.class_ii + row.class_iii + row.unclassified === 0);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          {report && (
            <p className="mt-2 max-w-prose text-muted-foreground">
              {formatDate(report.range.from)} to {formatDate(report.range.to)}, compared with{' '}
              {formatDate(report.range.previous_from)} to {formatDate(report.range.previous_to)}.
            </p>
          )}
        </div>
        <Button variant="outline" onClick={() => window.print()} disabled={!report} className="print:hidden">
          <Printer aria-hidden="true" /> Print or save as PDF
        </Button>
      </div>

      {/* Range controls */}
      <div className="mt-6 flex flex-wrap items-end gap-3 print:hidden">
        <div className="space-y-2">
          <Label htmlFor="range-preset">Period</Label>
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger id="range-preset" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_PRESETS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {preset === 'custom' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="range-from">From</Label>
              <Input
                id="range-from"
                type="date"
                className="w-44"
                max={toIsoDate(new Date())}
                value={custom.from}
                onChange={(event) => setCustom((prev) => ({ ...prev, from: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="range-to">To</Label>
              <Input
                id="range-to"
                type="date"
                className="w-44"
                max={toIsoDate(new Date())}
                value={custom.to}
                onChange={(event) => setCustom((prev) => ({ ...prev, to: event.target.value }))}
              />
            </div>
          </>
        )}
      </div>

      {invalid && <p className="mt-6 text-destructive">Choose a start date on or before the end date.</p>}

      {!invalid && error && (
        <p className="mt-6 text-destructive">The report couldn’t be generated. Refresh the page to try again.</p>
      )}

      {!invalid && loading && (
        <div className="mt-8 space-y-4" aria-busy="true">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      )}

      {!invalid && report && (
        <>
          <div className="mt-6 max-w-prose space-y-1 text-sm text-muted-foreground">
            <p>
              Recall data covers FDA reports from {formatDate(report.data_range.first)} to{' '}
              {formatDate(report.data_range.last)}.
            </p>
            {previousStartsBeforeData && (
              <p>
                The comparison period starts before the data does, so changes from the previous period look
                larger than they really are.
              </p>
            )}
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Recalls reported" {...report.summary.recalls} />
            <Metric label="Serious recalls (Class I)" {...report.summary.class_i} />
            <Metric label="Allergen recalls" {...report.summary.allergen} />
            <Metric label="Recalls closed" {...report.summary.closed} />
            <Metric label="New accounts" {...report.summary.signups} />
            <Metric label="Alerts created" {...report.summary.alerts} />
          </div>

          <div className="mt-10">
            <ReportSection
              title="Recalls over time"
              description={`Recalls reported per ${bucket}, by FDA risk class.`}
            >
              {trendIsEmpty ? (
                <EmptyChart />
              ) : (
                <ChartContainer config={TREND_CONFIG} className="aspect-auto h-72 w-full">
                  <BarChart data={trend} accessibilityLayer>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    {Object.keys(TREND_CONFIG).map((key) => (
                      <Bar key={key} dataKey={key} stackId="class" fill={`var(--color-${key})`} />
                    ))}
                  </BarChart>
                </ChartContainer>
              )}
            </ReportSection>

            <ReportSection
              title="Why products were recalled"
              description="Reasons grouped by keyword. A recall that mentions more than one reason counts once, under the first category listed."
            >
              <HorizontalBars
                data={report.reasons}
                labelKey="category"
                valueKey="recalls"
                valueLabel="Recalls"
                labelWidth={220}
              />
            </ReportSection>

            <ReportSection
              title="Undeclared allergens"
              description="How often each major allergen is named in allergen recalls. One recall can name several."
            >
              <HorizontalBars data={report.allergens} labelKey="label" valueKey="recalls" valueLabel="Recalls" />
            </ReportSection>

            <ReportSection
              title="Where recalled products were sold"
              description="The ten states named most often in recall distribution lists."
            >
              <HorizontalBars
                data={report.states}
                labelKey="state_code"
                valueKey="recalls"
                valueLabel="Recalls"
                labelWidth={48}
              />
              <p className="mt-3 text-sm text-muted-foreground">
                {report.coverage.nationwide.toLocaleString()} recalls were sold nationwide.{' '}
                {report.coverage.unknown.toLocaleString()} didn’t name a location the import could read.
              </p>
            </ReportSection>

            <ReportSection
              title="Time to close"
              description="Median days from the start of a recall to the FDA closing it, for recalls closed in this period."
            >
              {report.time_to_close.length === 0 ? (
                <EmptyChart>No recalls were closed in this period.</EmptyChart>
              ) : (
                <table className="w-full max-w-lg text-left text-sm">
                  <thead className="border-b text-muted-foreground">
                    <tr>
                      <th scope="col" className="py-2 font-medium">Risk class</th>
                      <th scope="col" className="py-2 text-right font-medium">Recalls closed</th>
                      <th scope="col" className="py-2 text-right font-medium">Median days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.time_to_close.map((row) => (
                      <tr key={row.classification}>
                        <td className="py-2">{CLASS_LABELS[row.classification] ?? row.classification}</td>
                        <td className="py-2 text-right tabular-nums">{row.recalls.toLocaleString()}</td>
                        <td className="py-2 text-right tabular-nums">{row.median_days.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ReportSection>

            <ReportSection
              title="Companies with the most recalls"
              description="Ranked by recall events. One event can cover many products."
            >
              {report.companies.length === 0 ? (
                <EmptyChart />
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-muted-foreground">
                    <tr>
                      <th scope="col" className="py-2 font-medium">Company</th>
                      <th scope="col" className="py-2 text-right font-medium">Recall events</th>
                      <th scope="col" className="py-2 text-right font-medium">Products</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.companies.map((row) => (
                      <tr key={row.company}>
                        <td className="py-2 pr-4">{row.company}</td>
                        <td className="py-2 text-right tabular-nums">{row.events.toLocaleString()}</td>
                        <td className="py-2 text-right tabular-nums">{row.products.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ReportSection>

            <ReportSection
              title="Sign-ups and alerts"
              description={`New accounts and alerts created per ${bucket}.`}
            >
              <div className="grid gap-8 md:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-medium">New accounts</h3>
                  <PeriodBars data={activity} valueKey="signups" valueLabel="New accounts" color="var(--chart-1)" />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-medium">Alerts created</h3>
                  <PeriodBars data={activity} valueKey="alerts" valueLabel="Alerts" color="var(--chart-4)" />
                </div>
              </div>
            </ReportSection>

            <ReportSection
              title="What users are watching"
              description="Current watchlists, whatever period is selected. Compare with the allergen chart above to see whether users watch for what actually gets recalled."
            >
              <div className="grid gap-8 md:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-medium">Most-watched terms</h3>
                  <HorizontalBars
                    data={report.top_terms}
                    labelKey="term"
                    valueKey="users"
                    valueLabel="Users watching"
                    color="var(--chart-5)"
                  />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-medium">Watchlist items by type</h3>
                  <HorizontalBars
                    data={watchTypes}
                    labelKey="label"
                    valueKey="items"
                    valueLabel="Items"
                    color="var(--chart-5)"
                    labelWidth={110}
                  />
                </div>
              </div>
            </ReportSection>
          </div>
        </>
      )}
    </div>
  );
}