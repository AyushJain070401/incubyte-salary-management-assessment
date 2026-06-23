// Deterministic seed for ACME Salary Management.
//
// Idempotent: TRUNCATEs employees / salaries / fx_rates with RESTART
// IDENTITY CASCADE, then re-inserts a fixed faker-generated dataset.
// Same input -> same DB, every time.
//
// Run with: pnpm --filter @acme/api seed

import { faker } from '@faker-js/faker';
import { PrismaClient } from '@prisma/client';

const SEED = 20260623;
const TOTAL_EMPLOYEES = 10_000;
const INSERT_CHUNK = 1_000;

const prisma = new PrismaClient();

// --- Reference data ---------------------------------------------------------

// 8 countries spanning 5 currencies. ISO-3166-1 alpha-2.
const COUNTRIES = ['US', 'GB', 'IN', 'JP', 'DE', 'FR', 'IT', 'ES'] as const;
type Country = (typeof COUNTRIES)[number];

const COUNTRY_CURRENCY: Record<Country, string> = {
  US: 'USD',
  GB: 'GBP',
  IN: 'INR',
  JP: 'JPY',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
};

const DEPARTMENTS = [
  'Engineering',
  'Product',
  'Design',
  'Sales',
  'Marketing',
  'Operations',
] as const;
type Department = (typeof DEPARTMENTS)[number];

// Roles by department. Each department has ~3 roles.
const ROLES_BY_DEPT: Record<Department, string[]> = {
  Engineering: ['Software Engineer', 'Engineering Manager', 'Site Reliability Engineer'],
  Product: ['Product Manager', 'Product Operations Manager'],
  Design: ['Product Designer', 'Design Manager'],
  Sales: ['Account Executive', 'Sales Manager'],
  Marketing: ['Marketing Specialist', 'Marketing Manager'],
  Operations: ['Operations Analyst', 'Operations Manager'],
};

const LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as const;
type Level = (typeof LEVELS)[number];

// Multiplier on the country's L3 baseline.
const LEVEL_MULT: Record<Level, number> = {
  L1: 0.6,
  L2: 0.8,
  L3: 1.0,
  L4: 1.4,
  L5: 1.85,
  L6: 2.4,
};

// Country baseline L3 salary in LOCAL currency MAJOR units.
const COUNTRY_BASELINE_MAJOR: Record<Country, number> = {
  US: 120_000,
  GB: 80_000,
  DE: 90_000,
  FR: 75_000,
  IT: 60_000,
  ES: 55_000,
  IN: 2_500_000, // 25 lakh INR
  JP: 9_000_000, // 9M JPY
};

// Gender distribution. Optional/nullable in schema; 5% null to represent
// "prefer not to say" / not on file. The remaining 95% split 50/50 with a
// small slice for non_binary.
const GENDER_WEIGHTS: Array<{ value: string | null; weight: number }> = [
  { value: 'female', weight: 0.47 },
  { value: 'male', weight: 0.47 },
  { value: 'non_binary', weight: 0.01 },
  { value: null, weight: 0.05 },
];

// Salary-history distribution. Weighted random over [1, 2, 3, 4] rows
// per employee. Skews short — most employees haven't been there long.
const HISTORY_WEIGHTS: Array<{ rows: number; weight: number }> = [
  { rows: 1, weight: 0.6 },
  { rows: 2, weight: 0.25 },
  { rows: 3, weight: 0.12 },
  { rows: 4, weight: 0.03 },
];

// FX rates anchored at June 2026. Direct pairs for every (from, to)
// combination of our 5 currencies. Approximate / illustrative — these
// are seed values, not live data.
function buildFxRates() {
  const asOf = new Date('2026-06-01');
  const usdRates: Record<string, number> = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.78,
    INR: 83.5,
    JPY: 150,
  };
  const currencies = Object.keys(usdRates);
  const rows: Array<{
    baseCurrency: string;
    quoteCurrency: string;
    rate: number;
    asOf: Date;
  }> = [];

  for (const from of currencies) {
    for (const to of currencies) {
      if (from === to) continue;
      const fromUsd = usdRates[from]!;
      const toUsd = usdRates[to]!;
      // base->quote rate is "1 unit of base = ? quote". Through USD:
      //   1 base = (1/fromUsd) USD = (toUsd/fromUsd) quote
      rows.push({
        baseCurrency: from,
        quoteCurrency: to,
        rate: round(toUsd / fromUsd, 6),
        asOf,
      });
    }
  }
  return rows;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// --- Helpers ---------------------------------------------------------------

function weightedPick<T>(weights: Array<{ value?: T; rows?: number; weight: number }>): T {
  const total = weights.reduce((s, w) => s + w.weight, 0);
  let roll = faker.number.float({ min: 0, max: total });
  for (const w of weights) {
    roll -= w.weight;
    if (roll <= 0) return (w.value ?? (w.rows as unknown)) as T;
  }
  return (weights[weights.length - 1]!.value ?? (weights[weights.length - 1]!.rows as unknown)) as T;
}

// Generate an employee_code from the country + a zero-padded sequence.
function makeEmployeeCode(country: Country, n: number): string {
  return `${country}-${String(n).padStart(5, '0')}`;
}

// Build a salary amount in LOCAL minor units for a given country + level
// with ±15% jitter. JPY has 0 minor digits; others have 2.
function generateSalaryMinor(country: Country, level: Level): bigint {
  const currency = COUNTRY_CURRENCY[country];
  const minorDigits = currency === 'JPY' ? 0 : 2;
  const baselineMajor = COUNTRY_BASELINE_MAJOR[country] * LEVEL_MULT[level];
  const jitterFactor = faker.number.float({ min: 0.85, max: 1.15 });
  const major = baselineMajor * jitterFactor;
  const minor = Math.round(major * 10 ** minorDigits);
  return BigInt(minor);
}

// Date helpers — explicit UTC to avoid TZ drift in seed output.
function isoDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

// --- Main ------------------------------------------------------------------

async function main() {
  faker.seed(SEED);

  const t0 = Date.now();
  console.log(`Seeding ${TOTAL_EMPLOYEES.toLocaleString()} employees (seed=${SEED})...`);

  // 1. Wipe everything. CASCADE handles the salaries FK.
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "salaries", "employees", "fx_rates" RESTART IDENTITY CASCADE;',
  );

  // 2. FX rates.
  const fxRows = buildFxRates();
  await prisma.fxRate.createMany({ data: fxRows });
  console.log(`  fx_rates: ${fxRows.length} rows`);

  // 3. Employees + salary history.
  const employees: Array<{
    id: string;
    employeeCode: string;
    fullName: string;
    email: string;
    country: string;
    department: string;
    role: string;
    level: string;
    hireDate: Date;
    status: string;
    gender: string | null;
  }> = [];

  const salaries: Array<{
    employeeId: string;
    amountMinor: bigint;
    currency: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    reason: string | null;
    changedBy: string | null;
  }> = [];

  const codeCounters: Record<Country, number> = Object.fromEntries(
    COUNTRIES.map((c) => [c, 0]),
  ) as Record<Country, number>;

  for (let i = 0; i < TOTAL_EMPLOYEES; i++) {
    const country = faker.helpers.arrayElement(COUNTRIES);
    const department = faker.helpers.arrayElement(DEPARTMENTS);
    const role = faker.helpers.arrayElement(ROLES_BY_DEPT[department]);
    const level = faker.helpers.arrayElement(LEVELS);
    const gender = weightedPick<string | null>(GENDER_WEIGHTS);

    codeCounters[country]++;
    const employeeCode = makeEmployeeCode(country, codeCounters[country]);

    const firstName = faker.person.firstName(
      gender === 'female' ? 'female' : gender === 'male' ? 'male' : undefined,
    );
    const lastName = faker.person.lastName();
    const fullName = `${firstName} ${lastName}`;
    // Suffix with the employee_code (already unique) so 10k emails are
    // guaranteed unique even when faker repeats a (first, last) pair.
    const emailLocal = `${firstName}.${lastName}.${employeeCode}`
      .toLowerCase()
      .replace(/[^a-z0-9.\-]/g, '');
    const email = `${emailLocal}@acme.test`;

    const yearsBack = faker.number.float({ min: 0.25, max: 8 });
    const hireDate = isoDate(faker.date.past({ years: yearsBack }));

    // 2% chance of being terminated; others are active.
    const status = faker.number.float({ min: 0, max: 1 }) < 0.02 ? 'terminated' : 'active';

    const id = faker.string.uuid();
    employees.push({
      id,
      employeeCode,
      fullName,
      email,
      country,
      department,
      role,
      level,
      hireDate,
      status,
      gender,
    });

    // Salary history. Number of rows is weighted; raise gap is ~12-24 months.
    const historyRows = weightedPick<number>(
      HISTORY_WEIGHTS.map((h) => ({ value: h.rows, weight: h.weight })),
    );

    const currency = COUNTRY_CURRENCY[country];
    let currentAmount = generateSalaryMinor(country, level);
    let currentFrom = hireDate;

    for (let r = 0; r < historyRows; r++) {
      const isLast = r === historyRows - 1;
      let effectiveTo: Date | null = null;
      let nextFrom: Date | null = null;

      if (!isLast) {
        const monthsToNextRaise = faker.number.int({ min: 12, max: 24 });
        nextFrom = addDays(currentFrom, monthsToNextRaise * 30);
        // Don't put a raise in the future relative to seed-time.
        if (nextFrom > new Date('2026-06-23')) {
          // Truncate history here.
          salaries.push({
            employeeId: id,
            amountMinor: currentAmount,
            currency,
            effectiveFrom: currentFrom,
            effectiveTo: null,
            reason: r === 0 ? 'Initial salary' : 'Annual raise',
            changedBy: null,
          });
          break;
        }
        effectiveTo = addDays(nextFrom, -1);
      }

      salaries.push({
        employeeId: id,
        amountMinor: currentAmount,
        currency,
        effectiveFrom: currentFrom,
        effectiveTo,
        reason: r === 0 ? 'Initial salary' : 'Annual raise',
        changedBy: null,
      });

      if (!isLast && nextFrom) {
        // Raise: +5% to +15% of current.
        const raiseFactor = faker.number.float({ min: 1.05, max: 1.15 });
        currentAmount = BigInt(Math.round(Number(currentAmount) * raiseFactor));
        currentFrom = nextFrom;
      }
    }
  }

  // 4. Bulk insert in chunks.
  for (let i = 0; i < employees.length; i += INSERT_CHUNK) {
    const chunk = employees.slice(i, i + INSERT_CHUNK);
    await prisma.employee.createMany({ data: chunk });
  }
  console.log(`  employees: ${employees.length.toLocaleString()} rows`);

  for (let i = 0; i < salaries.length; i += INSERT_CHUNK) {
    const chunk = salaries.slice(i, i + INSERT_CHUNK);
    await prisma.salary.createMany({ data: chunk });
  }
  console.log(`  salaries:  ${salaries.length.toLocaleString()} rows`);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
