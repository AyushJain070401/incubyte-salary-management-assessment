import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useEmployee, useSalaryHistory, useEmployeeChanges } from '../api/employees';
import { Button } from '../components/ui/Button';
import { SalaryHistory } from '../components/employees/SalaryHistory';
import { RaiseDialog } from '../components/employees/RaiseDialog';
import { EditEmployeeDialog } from '../components/employees/EditEmployeeDialog';
import { EmploymentHistory } from '../components/employees/EmploymentHistory';
import { formatDate, formatMoney } from '../lib/format';

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const employee = useEmployee(id);
  const history = useSalaryHistory(id);
  const changes = useEmployeeChanges(id);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (employee.isLoading) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }
  if (employee.isError || !employee.data) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
        {employee.error instanceof Error ? employee.error.message : 'Failed to load employee'}
        <div className="mt-2">
          <Link to="/employees" className="underline">
            ← Back to employees
          </Link>
        </div>
      </div>
    );
  }

  const e = employee.data;

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/employees" className="text-xs text-neutral-500 hover:underline">
            ← Employees
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{e.fullName}</h1>
          <p className="text-sm text-neutral-500 mt-0.5 font-mono">{e.employeeCode}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setEditOpen(true)}>
            Edit details…
          </Button>
          <Button onClick={() => setRaiseOpen(true)} disabled={e.status !== 'active'}>
            Give raise…
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <dl className="md:col-span-2 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-neutral-200 bg-white p-5 text-sm">
          <Field label="Email">{e.email}</Field>
          <Field label="Country">{e.country}</Field>
          <Field label="Department">{e.department}</Field>
          <Field label="Role">{e.role}</Field>
          <Field label="Level">{e.level}</Field>
          <Field label="Hired">{formatDate(e.hireDate)}</Field>
          <Field label="Status">
            {e.status === 'active' ? (
              <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                Active
              </span>
            ) : (
              <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                Terminated
              </span>
            )}
          </Field>
          <Field label="Gender">{e.gender ?? <span className="text-neutral-400">—</span>}</Field>
        </dl>

        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
            Current salary
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {e.currentSalary ? (
              formatMoney(e.currentSalary.amountMinor, e.currentSalary.currency)
            ) : (
              <span className="text-neutral-400 text-base">No salary on file</span>
            )}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4">Salary history</h2>
        {history.isLoading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : history.data ? (
          <SalaryHistory rows={history.data.items} />
        ) : (
          <p className="text-sm text-rose-700">Failed to load salary history.</p>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4">Employment history</h2>
        {changes.isLoading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : changes.data ? (
          <EmploymentHistory rows={changes.data.items} />
        ) : (
          <p className="text-sm text-rose-700">Failed to load employment history.</p>
        )}
      </div>

      <RaiseDialog open={raiseOpen} onClose={() => setRaiseOpen(false)} employee={e} />
      <EditEmployeeDialog open={editOpen} onClose={() => setEditOpen(false)} employee={e} />
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-neutral-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-neutral-900">{children}</dd>
    </div>
  );
}
