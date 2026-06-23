import { useState, type FormEvent } from 'react';
import type { EmployeeRead } from '@acme/shared';
import { majorToMinor } from '@acme/shared';

import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { useGiveRaise } from '../../api/employees';
import { ApiError } from '../../api/client';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY'];

// Today's date in YYYY-MM-DD, computed each render (cheap, no Date in module scope).
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function RaiseDialog({
  open,
  onClose,
  employee,
}: {
  open: boolean;
  onClose: () => void;
  employee: EmployeeRead;
}) {
  const defaultCurrency = employee.currentSalary?.currency ?? 'USD';
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useGiveRaise(employee.id);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const major = Number(amount);
    if (!Number.isFinite(major) || major <= 0) {
      setError('Enter a positive amount.');
      return;
    }

    try {
      const amountMinor = majorToMinor(major, currency);
      await mutation.mutateAsync({
        amountMinor,
        currency,
        effectiveFrom,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      // Reset + close on success.
      setAmount('');
      setReason('');
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.message ?? err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('failed to record raise');
      }
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Give ${employee.fullName} a raise`}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="amount">New annual salary (in major units)</Label>
          <div className="flex gap-2">
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 95000"
              className="flex-1"
            />
            <Select
              aria-label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Enter the salary as it appears on the offer (e.g. 95000 for $95,000.00).
          </p>
        </div>

        <div>
          <Label htmlFor="effectiveFrom">Effective from</Label>
          <Input
            id="effectiveFrom"
            type="date"
            required
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="reason">Reason (optional)</Label>
          <Input
            id="reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Annual review, Promotion to L4"
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
            {mutation.isPending ? 'Saving…' : 'Record raise'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
