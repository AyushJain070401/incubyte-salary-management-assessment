import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

import { useAnalytics, type AnalyticsParams } from '../api/analytics';
import { FilterBar, type FilterState } from '../components/employees/FilterBar';
import { formatMoney, formatMoneyCompact } from '../lib/format';

function paramsFromUrl(search: URLSearchParams): AnalyticsParams {
  const status = search.get('status');
  const out: AnalyticsParams = {
    search: search.get('search') ?? '',
    country: search.get('country') ?? '',
    department: search.get('department') ?? '',
    displayCurrency: search.get('displayCurrency') ?? 'USD',
  };
  if (status === 'active' || status === 'terminated') out.status = status;
  return out;
}

function setOrDelete(p: URLSearchParams, key: string, value: string) {
  if (value) p.set(key, value);
  else p.delete(key);
}

export function AnalyticsPage() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => paramsFromUrl(search), [search]);
  const { data, isLoading, isError, error } = useAnalytics(params);

  const filterState: FilterState = {
    search: params.search ?? '',
    country: params.country ?? '',
    department: params.department ?? '',
    status: params.status ?? '',
    displayCurrency: params.displayCurrency,
  };

  function onFilterChange(next: FilterState) {
    setSearch((prev) => {
      const p = new URLSearchParams(prev);
      setOrDelete(p, 'search', next.search);
      setOrDelete(p, 'country', next.country);
      setOrDelete(p, 'department', next.department);
      setOrDelete(p, 'status', next.status);
      p.set('displayCurrency', next.displayCurrency);
      return p;
    });
  }

  function onFilterClear() {
    setSearch(() => new URLSearchParams({ displayCurrency: params.displayCurrency }));
  }

  return (
    <section className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
        {data && (
          <span className="text-xs text-neutral-500">
            {data.totals.matching.toLocaleString()} employees match these filters
          </span>
        )}
      </div>

      <FilterBar value={filterState} onChange={onFilterChange} onClear={onFilterClear} />

      {isError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error instanceof Error ? error.message : 'Failed to load analytics'}
        </div>
      )}

      {isLoading && !data && (
        <p className="text-sm text-neutral-500">Loading…</p>
      )}

      {data && (
        <>
          {/* Salary stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Average"
              value={
                data.salary.avg
                  ? formatMoneyCompact(data.salary.avg.amountMinor, data.salary.avg.currency)
                  : '—'
              }
            />
            <StatCard
              label="Median"
              value={
                data.salary.median
                  ? formatMoneyCompact(
                      data.salary.median.amountMinor,
                      data.salary.median.currency,
                    )
                  : '—'
              }
            />
            <StatCard
              label="25th percentile"
              value={
                data.salary.p25
                  ? formatMoneyCompact(data.salary.p25.amountMinor, data.salary.p25.currency)
                  : '—'
              }
            />
            <StatCard
              label="75th percentile"
              value={
                data.salary.p75
                  ? formatMoneyCompact(data.salary.p75.amountMinor, data.salary.p75.currency)
                  : '—'
              }
            />
          </div>

          {/* Headcount charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard title="Headcount by country">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.headcount.byCountry}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#171717" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Headcount by department">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.headcount.byDepartment}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="key" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#171717" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Pay band distribution + top earners */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard title={`Pay bands (${data.salary.displayCurrency})`}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={data.bands.map((b) => ({
                    label: bandLabel(b.lowerMinor, b.upperMinor, data.salary.displayCurrency),
                    count: b.count,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <Card title="Top 10 earners">
              <ol className="text-sm space-y-1.5">
                {data.topEarners.map((t, i) => (
                  <li key={t.id} className="flex items-center gap-3">
                    <span className="w-5 text-right text-xs text-neutral-400 tabular-nums">
                      {i + 1}
                    </span>
                    <Link
                      to={`/employees/${t.id}`}
                      className="flex-1 truncate font-medium text-neutral-900 hover:underline"
                    >
                      {t.fullName}
                    </Link>
                    <span className="text-xs text-neutral-500">
                      {t.country} · {t.role}
                    </span>
                    <span className="tabular-nums text-sm font-medium">
                      {formatMoneyCompact(t.displaySalary.amountMinor, t.displaySalary.currency)}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          {/* Pay gap */}
          <Card title="Pay gap (indicative — not statistically controlled)">
            {data.payGap.suppressed ? (
              <p className="text-sm text-neutral-500">
                {data.payGap.reason ?? 'No data available.'}
              </p>
            ) : (
              <PayGapTable rows={data.payGap.rows} />
            )}
          </Card>
        </>
      )}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="text-xl font-semibold tabular-nums mt-1">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold mb-2">{title}</h2>
      {children}
    </div>
  );
}

// Convert minor-units boundaries to compact "$0-50k" style labels.
function bandLabel(lowerMinor: string, upperMinor: string | null, currency: string): string {
  const digits = currency === 'JPY' || currency === 'KRW' ? 0 : 2;
  const lowerMajor = Number(lowerMinor) / 10 ** digits;
  const upperMajor =
    upperMinor === null ? null : Number(upperMinor) / 10 ** digits;
  const k = (n: number) => `${Math.round(n / 1000)}k`;
  return upperMajor === null ? `${k(lowerMajor)}+` : `${k(lowerMajor)}–${k(upperMajor)}`;
}

function PayGapTable({
  rows,
}: {
  rows: Array<{
    country: string;
    role: string;
    gender: 'female' | 'male';
    count: number;
    avg: { amountMinor: string; currency: string };
  }>;
}) {
  // Group female/male into one row per (country, role).
  type Bucket = { country: string; role: string; female?: typeof rows[number]; male?: typeof rows[number] };
  const buckets = new Map<string, Bucket>();
  for (const r of rows) {
    const k = `${r.country}|${r.role}`;
    const b = buckets.get(k) ?? { country: r.country, role: r.role };
    b[r.gender] = r;
    buckets.set(k, b);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-neutral-500 border-b border-neutral-200">
          <tr>
            <th className="text-left py-1.5 pr-4">Country</th>
            <th className="text-left py-1.5 pr-4">Role</th>
            <th className="text-right py-1.5 pr-4">Female (avg)</th>
            <th className="text-right py-1.5 pr-4">Male (avg)</th>
            <th className="text-right py-1.5">Gap</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {Array.from(buckets.values())
            .filter((b) => b.female && b.male)
            .map((b) => {
              const f = b.female!;
              const m = b.male!;
              const fMajor = Number(f.avg.amountMinor);
              const mMajor = Number(m.avg.amountMinor);
              const gap = mMajor === 0 ? 0 : ((mMajor - fMajor) / mMajor) * 100;
              const gapClass =
                Math.abs(gap) < 2
                  ? 'text-neutral-500'
                  : gap > 0
                    ? 'text-rose-700'
                    : 'text-emerald-700';
              return (
                <tr key={`${b.country}|${b.role}`}>
                  <td className="py-1.5 pr-4">{b.country}</td>
                  <td className="py-1.5 pr-4">{b.role}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">
                    {formatMoney(f.avg.amountMinor, f.avg.currency)}
                    <span className="text-[11px] text-neutral-400 ml-1">n={f.count}</span>
                  </td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">
                    {formatMoney(m.avg.amountMinor, m.avg.currency)}
                    <span className="text-[11px] text-neutral-400 ml-1">n={m.count}</span>
                  </td>
                  <td className={`py-1.5 text-right tabular-nums ${gapClass}`}>
                    {gap > 0 ? '+' : ''}
                    {gap.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
