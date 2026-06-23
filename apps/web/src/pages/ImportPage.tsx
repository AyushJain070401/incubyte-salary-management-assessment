import { useState, type ChangeEvent } from 'react';

import { Button } from '../components/ui/Button';
import { ImportReportView } from '../components/import/ImportReportView';
import { useCommitImport, useDryRunImport } from '../api/import';
import { ApiError } from '../api/client';

const EXAMPLE_CSV = `employee_code,full_name,email,country,department,role,level,hire_date,status,gender,salary_amount_minor,salary_currency,salary_effective_from
ACME-00001,Jane Doe,jane@acme.test,US,Engineering,Software Engineer,L4,2026-03-01,active,female,18000000,USD,2026-03-01
ACME-00002,Raj Patel,raj@acme.test,IN,Product,Product Manager,L3,2026-02-15,active,male,3500000,INR,
`;

export function ImportPage() {
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dryRun = useDryRunImport();
  const commit = useCommitImport();

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    dryRun.reset();
    commit.reset();
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsv(text);
    runDryRun(text);
  }

  async function runDryRun(text: string) {
    setError(null);
    commit.reset();
    try {
      await dryRun.mutateAsync(text);
    } catch (err) {
      if (err instanceof ApiError) setError(err.body?.message ?? err.message);
      else if (err instanceof Error) setError(err.message);
      else setError('Dry-run failed');
    }
  }

  async function runCommit() {
    setError(null);
    try {
      await commit.mutateAsync(csv);
    } catch (err) {
      if (err instanceof ApiError) setError(err.body?.message ?? err.message);
      else if (err instanceof Error) setError(err.message);
      else setError('Commit failed');
    }
  }

  function loadExample() {
    setFileName('example.csv');
    setCsv(EXAMPLE_CSV);
    runDryRun(EXAMPLE_CSV);
  }

  function reset() {
    setCsv('');
    setFileName(null);
    setError(null);
    dryRun.reset();
    commit.reset();
  }

  const report = dryRun.data;
  const canCommit = report && report.invalid === 0 && report.total > 0 && !commit.data;
  const committed = commit.data;

  return (
    <section className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">CSV import</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Upload a CSV exported from your existing spreadsheets. We validate
          every row first, then commit them in a single transaction once you
          confirm.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm font-medium">
            CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onFileChange}
              className="block mt-2 text-xs file:mr-3 file:rounded-md file:border-0
                         file:bg-neutral-900 file:text-white file:px-3 file:py-1.5
                         file:text-xs file:font-medium file:cursor-pointer
                         file:hover:bg-neutral-800"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={loadExample}>
              Load example
            </Button>
            {fileName && (
              <Button variant="ghost" size="sm" onClick={reset}>
                Reset
              </Button>
            )}
          </div>
        </div>

        {fileName && (
          <p className="text-xs text-neutral-500">
            {fileName} · {csv.length.toLocaleString()} bytes
          </p>
        )}

        <details className="text-xs text-neutral-600">
          <summary className="cursor-pointer text-neutral-700 hover:text-neutral-900">
            Expected columns
          </summary>
          <p className="mt-2 leading-relaxed">
            Required:{' '}
            <code className="text-neutral-800">
              employee_code, full_name, email, country, department, role, level, hire_date
            </code>
            <br />
            Optional:{' '}
            <code className="text-neutral-800">
              status, gender, salary_amount_minor, salary_currency, salary_effective_from
            </code>
            <br />
            Dates as <code>YYYY-MM-DD</code>. Salary amounts as integer minor units (e.g.
            18000000 for $180,000.00). Salary fields must be set together.
          </p>
        </details>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {dryRun.isPending && (
        <p className="text-sm text-neutral-500">Validating…</p>
      )}

      {report && !committed && <ImportReportView report={report} />}

      {report && !committed && (
        <div className="flex items-center justify-end gap-3">
          {!canCommit && report.invalid > 0 && (
            <span className="text-xs text-neutral-500">
              Fix the issues above and re-upload.
            </span>
          )}
          <Button
            onClick={runCommit}
            disabled={!canCommit || commit.isPending}
          >
            {commit.isPending
              ? 'Committing…'
              : `Commit ${report.valid.toLocaleString()} row${report.valid === 1 ? '' : 's'}`}
          </Button>
        </div>
      )}

      {committed && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Imported {committed.inserted.employees.toLocaleString()} employees and{' '}
          {committed.inserted.salaries.toLocaleString()} salary rows.
        </div>
      )}
    </section>
  );
}
