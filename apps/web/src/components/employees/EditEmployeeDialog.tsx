import { useState, useEffect, type FormEvent } from 'react';
import type { EmployeeRead } from '@acme/shared';

import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { useUpdateEmployee } from '../../api/employees';
import { ApiError } from '../../api/client';

const COUNTRIES = ['AU', 'CA', 'DE', 'FR', 'GB', 'IN', 'JP', 'NL', 'SG', 'US'];
const STATUSES = ['active', 'terminated'] as const;
const GENDERS = ['female', 'male', 'non_binary'] as const;

export function EditEmployeeDialog({
  open,
  onClose,
  employee,
}: {
  open: boolean;
  onClose: () => void;
  employee: EmployeeRead;
}) {
  const [fullName, setFullName] = useState(employee.fullName);
  const [email, setEmail] = useState(employee.email);
  const [country, setCountry] = useState(employee.country);
  const [department, setDepartment] = useState(employee.department);
  const [role, setRole] = useState(employee.role);
  const [level, setLevel] = useState(employee.level);
  const [status, setStatus] = useState<'active' | 'terminated'>(employee.status);
  const [gender, setGender] = useState<string>(employee.gender ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Re-seed when employee prop changes (e.g. after a save refreshes the query).
  useEffect(() => {
    setFullName(employee.fullName);
    setEmail(employee.email);
    setCountry(employee.country);
    setDepartment(employee.department);
    setRole(employee.role);
    setLevel(employee.level);
    setStatus(employee.status);
    setGender(employee.gender ?? '');
    setReason('');
    setError(null);
  }, [employee]);

  const mutation = useUpdateEmployee(employee.id);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const patch: Record<string, string | null> = {};
    if (fullName !== employee.fullName) patch.fullName = fullName;
    if (email !== employee.email) patch.email = email;
    if (country !== employee.country) patch.country = country;
    if (department !== employee.department) patch.department = department;
    if (role !== employee.role) patch.role = role;
    if (level !== employee.level) patch.level = level;
    if (status !== employee.status) patch.status = status;
    const newGender = gender === '' ? null : gender;
    if (newGender !== employee.gender) patch.gender = newGender;

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    if (reason.trim()) patch.reason = reason.trim();

    try {
      await mutation.mutateAsync(patch as never);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.message ?? err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save changes');
      }
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Edit ${employee.fullName}`}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="edit-fullName">Full name</Label>
            <Input
              id="edit-fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              maxLength={120}
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
            />
          </div>

          <div>
            <Label htmlFor="edit-country">Country</Label>
            <Select
              id="edit-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full"
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-status">Status</Label>
            <Select
              id="edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'terminated')}
              className="w-full"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-department">Department</Label>
            <Input
              id="edit-department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
              maxLength={120}
            />
          </div>

          <div>
            <Label htmlFor="edit-role">Role</Label>
            <Input
              id="edit-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              maxLength={120}
            />
          </div>

          <div>
            <Label htmlFor="edit-level">Level</Label>
            <Input
              id="edit-level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              required
              maxLength={120}
            />
          </div>

          <div>
            <Label htmlFor="edit-gender">Gender (optional)</Label>
            <Select
              id="edit-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full"
            >
              <option value="">—</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="edit-reason">Reason for change (optional)</Label>
          <Input
            id="edit-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Relocated to London office, Promoted to new role"
            maxLength={500}
          />
        </div>

        {error && (
          <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
