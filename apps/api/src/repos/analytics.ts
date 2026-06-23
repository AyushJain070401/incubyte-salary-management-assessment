import { Prisma } from '@prisma/client';
import type { AnalyticsQuery } from '@acme/shared';

import { prisma } from '../db/client.js';

// Bands in major units of the display currency. Open-ended at the top.
// Lower bound inclusive, upper exclusive.
const BAND_BOUNDARIES_MAJOR = [0, 50_000, 100_000, 150_000, 200_000, 300_000];

// Currency -> minor unit digits. Mirrors @acme/shared/money.ts.
const minorDigitsCase = (col: Prisma.Sql) => Prisma.sql`
  CASE
    WHEN ${col} IN ('JPY', 'KRW') THEN 0
    WHEN ${col} IN ('BHD', 'KWD', 'TND') THEN 3
    ELSE 2
  END
`;

// Build the WHERE fragment from the analytics filter set.
function buildWhere(q: AnalyticsQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (q.country) conditions.push(Prisma.sql`e.country = ${q.country}`);
  if (q.department) conditions.push(Prisma.sql`e.department = ${q.department}`);
  if (q.role) conditions.push(Prisma.sql`e.role = ${q.role}`);
  if (q.status) conditions.push(Prisma.sql`e.status = ${q.status}`);
  if (q.search) {
    const like = `%${q.search}%`;
    conditions.push(
      Prisma.sql`(e.full_name ILIKE ${like} OR e.email ILIKE ${like} OR e.employee_code ILIKE ${like})`,
    );
  }
  if (conditions.length === 0) return Prisma.sql`TRUE`;
  return conditions.reduce<Prisma.Sql>(
    (acc, c, i) => (i === 0 ? c : Prisma.sql`${acc} AND ${c}`),
    Prisma.empty,
  );
}

// Re-usable CTE that joins each employee with their current salary
// (effective_to IS NULL) and the latest FX rate to the display currency.
// Adds display_amount_minor as a numeric column.
function withDisplayCte(q: AnalyticsQuery): Prisma.Sql {
  const displayDigits = minorDigitsCase(Prisma.sql`${q.displayCurrency}::text`);
  return Prisma.sql`
    WITH current_salary AS (
      SELECT
        s.employee_id, s.amount_minor, s.currency,
        ${minorDigitsCase(Prisma.sql`s.currency`)} AS source_digits
      FROM salaries s WHERE s.effective_to IS NULL
    ),
    fx AS (
      SELECT DISTINCT ON (base_currency, quote_currency)
        base_currency, quote_currency, rate
      FROM fx_rates
      WHERE quote_currency = ${q.displayCurrency}
      ORDER BY base_currency, quote_currency, as_of DESC
    ),
    base AS (
      SELECT
        e.*,
        cs.amount_minor AS current_amount_minor,
        cs.currency      AS current_currency,
        CASE
          WHEN cs.amount_minor IS NULL THEN NULL
          WHEN cs.currency = ${q.displayCurrency} THEN cs.amount_minor::numeric
          WHEN fx.rate IS NULL THEN NULL
          ELSE cs.amount_minor::numeric
            * fx.rate
            * POWER(10, ${displayDigits} - cs.source_digits)
        END AS display_amount_minor
      FROM employees e
      LEFT JOIN current_salary cs ON cs.employee_id = e.id
      LEFT JOIN fx ON fx.base_currency = cs.currency
      WHERE ${buildWhere(q)}
    )
  `;
}

// --- Totals ----------------------------------------------------------------

export type TotalsRow = { matching: number; active: number; terminated: number };

export async function fetchTotals(q: AnalyticsQuery): Promise<TotalsRow> {
  const [row] = await prisma.$queryRaw<
    Array<{ matching: bigint; active: bigint; terminated: bigint }>
  >(Prisma.sql`
    ${withDisplayCte(q)}
    SELECT
      COUNT(*)::bigint AS matching,
      COUNT(*) FILTER (WHERE status = 'active')::bigint AS active,
      COUNT(*) FILTER (WHERE status = 'terminated')::bigint AS terminated
    FROM base
  `);
  return {
    matching: Number(row?.matching ?? 0n),
    active: Number(row?.active ?? 0n),
    terminated: Number(row?.terminated ?? 0n),
  };
}

// --- Headcount -------------------------------------------------------------

export type HeadcountBucket = { key: string; count: number };

export async function fetchHeadcountByCountry(q: AnalyticsQuery): Promise<HeadcountBucket[]> {
  const rows = await prisma.$queryRaw<Array<{ key: string; count: bigint }>>(Prisma.sql`
    ${withDisplayCte(q)}
    SELECT country AS key, COUNT(*)::bigint AS count
    FROM base
    GROUP BY country
    ORDER BY count DESC, country ASC
  `);
  return rows.map((r) => ({ key: r.key.trim(), count: Number(r.count) }));
}

export async function fetchHeadcountByDepartment(q: AnalyticsQuery): Promise<HeadcountBucket[]> {
  const rows = await prisma.$queryRaw<Array<{ key: string; count: bigint }>>(Prisma.sql`
    ${withDisplayCte(q)}
    SELECT department AS key, COUNT(*)::bigint AS count
    FROM base
    GROUP BY department
    ORDER BY count DESC, department ASC
  `);
  return rows.map((r) => ({ key: r.key, count: Number(r.count) }));
}

// --- Salary distribution ---------------------------------------------------

export type SalaryDistRow = {
  count: number;
  avg: bigint | null;
  median: bigint | null;
  p25: bigint | null;
  p75: bigint | null;
};

export async function fetchSalaryDistribution(q: AnalyticsQuery): Promise<SalaryDistRow> {
  const [row] = await prisma.$queryRaw<
    Array<{
      count: bigint;
      avg: string | null;
      median: string | null;
      p25: string | null;
      p75: string | null;
    }>
  >(Prisma.sql`
    ${withDisplayCte(q)}
    SELECT
      COUNT(display_amount_minor)::bigint AS count,
      ROUND(AVG(display_amount_minor))::text AS avg,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY display_amount_minor))::text AS median,
      ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY display_amount_minor))::text AS p25,
      ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY display_amount_minor))::text AS p75
    FROM base
    WHERE display_amount_minor IS NOT NULL
  `);

  const toBigInt = (s: string | null) => (s === null ? null : BigInt(s));

  return {
    count: Number(row?.count ?? 0n),
    avg: toBigInt(row?.avg ?? null),
    median: toBigInt(row?.median ?? null),
    p25: toBigInt(row?.p25 ?? null),
    p75: toBigInt(row?.p75 ?? null),
  };
}

// --- Top earners -----------------------------------------------------------

export type TopEarnerRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  country: string;
  department: string;
  role: string;
  displayAmountMinor: bigint;
};

export async function fetchTopEarners(q: AnalyticsQuery, limit = 10): Promise<TopEarnerRow[]> {
  // Note: we alias the rounded text value to `display_text` rather than
  // re-using `display_amount_minor`. If the alias shadowed the CTE
  // column, the ORDER BY would sort the TEXT representation
  // lexicographically — "9998129" would sort above "39473463" and the
  // top earner would be wrong.
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      employee_code: string;
      full_name: string;
      country: string;
      department: string;
      role: string;
      display_text: string;
    }>
  >(Prisma.sql`
    ${withDisplayCte(q)}
    SELECT id, employee_code, full_name, country, department, role,
           ROUND(display_amount_minor)::text AS display_text
    FROM base
    WHERE display_amount_minor IS NOT NULL
    ORDER BY display_amount_minor DESC, id ASC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    id: r.id,
    employeeCode: r.employee_code,
    fullName: r.full_name,
    country: r.country.trim(),
    department: r.department,
    role: r.role,
    displayAmountMinor: BigInt(r.display_text),
  }));
}

// --- Bands -----------------------------------------------------------------

export type BandRow = { lowerMinor: bigint; upperMinor: bigint | null; count: number };

export async function fetchBands(q: AnalyticsQuery): Promise<BandRow[]> {
  // Convert boundaries to MINOR units of the display currency.
  // We do this in JS (small, easy) rather than as a SQL CASE expression.
  const displayMinorDigits =
    q.displayCurrency === 'JPY' || q.displayCurrency === 'KRW'
      ? 0
      : q.displayCurrency === 'BHD' || q.displayCurrency === 'KWD' || q.displayCurrency === 'TND'
        ? 3
        : 2;
  const factor = BigInt(10 ** displayMinorDigits);
  const boundaries = BAND_BOUNDARIES_MAJOR.map((b) => BigInt(b) * factor);

  // Build the CASE bucket assignment from the boundaries.
  const bucketCase = boundaries
    .slice(1)
    .map((upper, i) => Prisma.sql`WHEN display_amount_minor < ${upper} THEN ${i}`);
  const bucketExpr = Prisma.sql`
    CASE
      ${bucketCase.reduce<Prisma.Sql>(
        (acc, c, i) => (i === 0 ? c : Prisma.sql`${acc} ${c}`),
        Prisma.empty,
      )}
      ELSE ${boundaries.length - 1}
    END
  `;

  const rows = await prisma.$queryRaw<Array<{ bucket: number; count: bigint }>>(Prisma.sql`
    ${withDisplayCte(q)}
    SELECT ${bucketExpr} AS bucket, COUNT(*)::bigint AS count
    FROM base
    WHERE display_amount_minor IS NOT NULL
    GROUP BY bucket
    ORDER BY bucket ASC
  `);

  const counts = new Array(boundaries.length).fill(0);
  for (const r of rows) counts[Number(r.bucket)] = Number(r.count);

  return boundaries.map((lower, i) => ({
    lowerMinor: lower,
    upperMinor: i === boundaries.length - 1 ? null : boundaries[i + 1]!,
    count: counts[i] ?? 0,
  }));
}

// --- Pay gap ---------------------------------------------------------------

export type PayGapRow = {
  country: string;
  role: string;
  gender: 'female' | 'male';
  count: number;
  avg: bigint;
};

// Minimum sample size PER GENDER GROUP. Below this we don't surface the
// figure (statistical noise + privacy). Documented in REQUIREMENTS.md.
const PAY_GAP_MIN_N = 5;

export async function fetchPayGap(q: AnalyticsQuery): Promise<PayGapRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      country: string;
      role: string;
      gender: string;
      count: bigint;
      avg: string;
    }>
  >(Prisma.sql`
    ${withDisplayCte(q)},
    grouped AS (
      SELECT
        country, role, gender,
        COUNT(*)::bigint AS count,
        ROUND(AVG(display_amount_minor))::text AS avg
      FROM base
      WHERE gender IN ('female', 'male')
        AND display_amount_minor IS NOT NULL
      GROUP BY country, role, gender
    ),
    -- Only keep (country, role) pairs where BOTH female AND male have >= MIN_N
    eligible AS (
      SELECT country, role
      FROM grouped
      GROUP BY country, role
      HAVING COUNT(*) FILTER (WHERE gender = 'female' AND count >= ${PAY_GAP_MIN_N}) > 0
         AND COUNT(*) FILTER (WHERE gender = 'male'   AND count >= ${PAY_GAP_MIN_N}) > 0
    )
    SELECT g.country, g.role, g.gender, g.count, g.avg
    FROM grouped g
    INNER JOIN eligible e ON e.country = g.country AND e.role = g.role
    WHERE g.gender IN ('female', 'male')
      AND g.count >= ${PAY_GAP_MIN_N}
    ORDER BY g.country, g.role, g.gender
  `);

  return rows.map((r) => ({
    country: r.country.trim(),
    role: r.role,
    gender: r.gender as 'female' | 'male',
    count: Number(r.count),
    avg: BigInt(r.avg),
  }));
}
