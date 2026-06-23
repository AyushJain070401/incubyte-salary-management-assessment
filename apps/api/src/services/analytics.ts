import type { AnalyticsQuery, AnalyticsResponse, Money } from '@acme/shared';

import {
  fetchTotals,
  fetchHeadcountByCountry,
  fetchHeadcountByDepartment,
  fetchSalaryDistribution,
  fetchTopEarners,
  fetchBands,
  fetchPayGap,
} from '../repos/analytics.js';
import { toWire } from '../domain/money.js';

function toMoney(amount: bigint | null, currency: string): Money | null {
  if (amount === null) return null;
  return { amountMinor: toWire(amount), currency };
}

// Runs all six analytics queries in parallel; assembles the response in the
// shape declared by @acme/shared.AnalyticsResponseSchema.
export async function analyticsService(q: AnalyticsQuery): Promise<AnalyticsResponse> {
  const [totals, byCountry, byDepartment, dist, top, bands, payGap] = await Promise.all([
    fetchTotals(q),
    fetchHeadcountByCountry(q),
    fetchHeadcountByDepartment(q),
    fetchSalaryDistribution(q),
    fetchTopEarners(q, 10),
    fetchBands(q),
    fetchPayGap(q),
  ]);

  return {
    filters: q,
    totals,
    headcount: {
      byCountry,
      byDepartment,
    },
    salary: {
      displayCurrency: q.displayCurrency,
      count: dist.count,
      avg: toMoney(dist.avg, q.displayCurrency),
      median: toMoney(dist.median, q.displayCurrency),
      p25: toMoney(dist.p25, q.displayCurrency),
      p75: toMoney(dist.p75, q.displayCurrency),
    },
    topEarners: top.map((t) => ({
      id: t.id,
      employeeCode: t.employeeCode,
      fullName: t.fullName,
      country: t.country,
      department: t.department,
      role: t.role,
      displaySalary: { amountMinor: toWire(t.displayAmountMinor), currency: q.displayCurrency },
    })),
    bands: bands.map((b) => ({
      lowerMinor: toWire(b.lowerMinor),
      upperMinor: b.upperMinor === null ? null : toWire(b.upperMinor),
      count: b.count,
    })),
    payGap: {
      suppressed: payGap.length === 0,
      reason:
        payGap.length === 0
          ? 'no (country, role) pair has at least 5 employees in both female and male groups for the current filters'
          : null,
      rows: payGap.map((p) => ({
        country: p.country,
        role: p.role,
        gender: p.gender,
        count: p.count,
        avg: { amountMinor: toWire(p.avg), currency: q.displayCurrency },
      })),
    },
  };
}
