import type { EmployeeChangeRead } from '@acme/shared';

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full name',
  email: 'Email',
  country: 'Country',
  department: 'Department',
  role: 'Role',
  level: 'Level',
  status: 'Status',
  gender: 'Gender',
};

function formatValue(field: string, value: string | null): string {
  if (value === null) return '—';
  if (field === 'status') return value.charAt(0).toUpperCase() + value.slice(1);
  if (field === 'gender') return value.replace('_', ' ');
  return value;
}

// Group consecutive rows with the same changedAt timestamp together so a
// multi-field edit shows as a single event.
function groupByEvent(rows: EmployeeChangeRead[]): EmployeeChangeRead[][] {
  if (rows.length === 0) return [];
  const groups: EmployeeChangeRead[][] = [];
  let current: EmployeeChangeRead[] = [rows[0]!];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]!.changedAt === current[0]!.changedAt && rows[i]!.changedBy === current[0]!.changedBy) {
      current.push(rows[i]!);
    } else {
      groups.push(current);
      current = [rows[i]!];
    }
  }
  groups.push(current);
  return groups;
}

export function EmploymentHistory({ rows }: { rows: EmployeeChangeRead[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500">No profile changes recorded.</p>;
  }

  const groups = groupByEvent(rows);

  return (
    <ol className="space-y-4">
      {groups.map((group) => {
        const first = group[0]!;
        const date = new Date(first.changedAt).toLocaleString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <li key={first.id} className="relative pl-5 border-l-2 border-neutral-200">
            <span
              className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-blue-400"
              aria-hidden
            />

            <div className="text-xs text-neutral-500 mb-1">
              {date}
              {first.changedBy && (
                <span className="font-mono ml-2 text-neutral-400">
                  by {first.changedBy.slice(0, 8)}…
                </span>
              )}
            </div>

            <div className="space-y-1">
              {group.map((row) => (
                <div key={row.id} className="text-sm">
                  <span className="text-neutral-500 text-xs uppercase tracking-wide mr-1.5">
                    {FIELD_LABELS[row.field] ?? row.field}
                  </span>
                  <span className="text-neutral-400 line-through text-xs">
                    {formatValue(row.field, row.oldValue)}
                  </span>
                  <span className="text-neutral-400 mx-1 text-xs">→</span>
                  <span className="text-neutral-900 text-xs font-medium">
                    {formatValue(row.field, row.newValue)}
                  </span>
                </div>
              ))}
            </div>

            {first.reason && (
              <div className="text-xs text-neutral-700 mt-1 italic">"{first.reason}"</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
