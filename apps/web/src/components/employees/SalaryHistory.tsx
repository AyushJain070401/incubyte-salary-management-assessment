import type { SalaryRead } from '@acme/shared';
import { formatMoney, formatDate } from '../../lib/format';

// Newest-first timeline; the topmost row (with effectiveTo === null) is
// the current salary.
export function SalaryHistory({ rows }: { rows: SalaryRead[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500">No salary history on file.</p>
    );
  }

  return (
    <ol className="space-y-3">
      {rows.map((row, i) => {
        const current = row.effectiveTo === null;
        return (
          <li
            key={row.id}
            className="relative pl-5 border-l-2 border-neutral-200"
          >
            <span
              className={`absolute -left-[5px] top-1.5 h-2 w-2 rounded-full ${
                current ? 'bg-emerald-500' : 'bg-neutral-300'
              }`}
              aria-hidden
            />
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-base font-medium tabular-nums">
                {formatMoney(row.amountMinor, row.currency)}
              </span>
              {current ? (
                <span className="text-[10px] uppercase tracking-wide font-medium text-emerald-700">
                  Current
                </span>
              ) : (
                <span className="text-xs text-neutral-400">#{rows.length - i}</span>
              )}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {formatDate(row.effectiveFrom)}
              {row.effectiveTo ? ` → ${formatDate(row.effectiveTo)}` : ' → present'}
            </div>
            {row.reason && (
              <div className="text-xs text-neutral-700 mt-1 italic">
                "{row.reason}"
              </div>
            )}
            {row.changedBy && (
              <div className="text-[11px] text-neutral-400 mt-0.5 font-mono">
                by {row.changedBy.slice(0, 8)}…
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
