import type { ImportReport } from '@acme/shared';

export function ImportReportView({ report }: { report: ImportReport }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center gap-4 px-5 py-3 border-b border-neutral-100 text-sm">
        <span className="font-medium">{report.total.toLocaleString()} rows</span>
        <span className="text-emerald-700">{report.valid.toLocaleString()} valid</span>
        {report.invalid > 0 && (
          <span className="text-rose-700">{report.invalid.toLocaleString()} invalid</span>
        )}
      </div>
      {report.invalid > 0 && (
        <div className="px-5 py-3 border-b border-neutral-100">
          <h3 className="text-xs font-medium text-neutral-700 mb-2">
            Issues (first 100 shown)
          </h3>
          <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-2">
            {report.rows
              .filter((r) => !r.valid)
              .slice(0, 100)
              .map((r) => (
                <li key={r.rowNumber} className="text-xs">
                  <span className="font-mono text-neutral-500">row {r.rowNumber}</span>
                  {r.employeeCode && (
                    <span className="font-mono text-neutral-700"> · {r.employeeCode}</span>
                  )}
                  <ul className="mt-0.5 ml-4 list-disc text-rose-700">
                    {r.errors.map((e, i) => (
                      <li key={i}>
                        <span className="font-mono text-neutral-600">{e.path || '·'}</span>
                        {' — '}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
