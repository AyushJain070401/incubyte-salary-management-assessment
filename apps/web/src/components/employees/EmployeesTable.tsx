import { Link } from 'react-router-dom';
import type { EmployeeRead } from '@acme/shared';

import { formatMoneyCompact, formatDate } from '../../lib/format';

type SortField = 'fullName' | 'hireDate' | 'salary';

type Props = {
  rows: EmployeeRead[];
  loading: boolean;
  sortBy: SortField;
  sortDir: 'asc' | 'desc';
  onSort: (field: SortField) => void;
};

function SortableHeader({
  field,
  current,
  dir,
  onClick,
  children,
  className = '',
}: {
  field: SortField;
  current: SortField;
  dir: 'asc' | 'desc';
  onClick: (f: SortField) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const active = current === field;
  const arrow = active ? (dir === 'asc' ? '▲' : '▼') : '';
  return (
    <th className={`text-left text-xs font-medium text-neutral-500 px-3 py-2 ${className}`}>
      <button
        onClick={() => onClick(field)}
        className={`inline-flex items-center gap-1 hover:text-neutral-900 ${
          active ? 'text-neutral-900' : ''
        }`}
      >
        {children}
        {arrow && <span className="text-[10px]">{arrow}</span>}
      </button>
    </th>
  );
}

export function EmployeesTable({ rows, loading, sortBy, sortDir, onSort }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 border-b border-neutral-200">
          <tr>
            <th className="text-left text-xs font-medium text-neutral-500 px-3 py-2">Code</th>
            <SortableHeader field="fullName" current={sortBy} dir={sortDir} onClick={onSort}>
              Name
            </SortableHeader>
            <th className="text-left text-xs font-medium text-neutral-500 px-3 py-2">Country</th>
            <th className="text-left text-xs font-medium text-neutral-500 px-3 py-2">
              Department
            </th>
            <th className="text-left text-xs font-medium text-neutral-500 px-3 py-2">Role</th>
            <th className="text-left text-xs font-medium text-neutral-500 px-3 py-2">Level</th>
            <SortableHeader field="hireDate" current={sortBy} dir={sortDir} onClick={onSort}>
              Hired
            </SortableHeader>
            <SortableHeader
              field="salary"
              current={sortBy}
              dir={sortDir}
              onClick={onSort}
              className="text-right"
            >
              Salary
            </SortableHeader>
            <th className="text-left text-xs font-medium text-neutral-500 px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.length === 0 && !loading && (
            <tr>
              <td colSpan={9} className="px-3 py-8 text-center text-neutral-500 text-sm">
                No employees match the current filters.
              </td>
            </tr>
          )}
          {rows.map((e) => (
            <tr
              key={e.id}
              className="hover:bg-neutral-50 transition-colors"
            >
              <td className="px-3 py-2 text-neutral-500 font-mono text-xs">
                {e.employeeCode}
              </td>
              <td className="px-3 py-2">
                <Link
                  to={`/employees/${e.id}`}
                  className="font-medium text-neutral-900 hover:underline"
                >
                  {e.fullName}
                </Link>
              </td>
              <td className="px-3 py-2 text-neutral-700">{e.country}</td>
              <td className="px-3 py-2 text-neutral-700">{e.department}</td>
              <td className="px-3 py-2 text-neutral-700">{e.role}</td>
              <td className="px-3 py-2 text-neutral-500 text-xs">{e.level}</td>
              <td className="px-3 py-2 text-neutral-500 text-xs">{formatDate(e.hireDate)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {e.displaySalary ? (
                  formatMoneyCompact(e.displaySalary.amountMinor, e.displaySalary.currency)
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                {e.status === 'active' ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    Active
                  </span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                    Terminated
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {loading && (
        <div className="px-3 py-2 border-t border-neutral-100 text-xs text-neutral-400">
          Loading…
        </div>
      )}
    </div>
  );
}
