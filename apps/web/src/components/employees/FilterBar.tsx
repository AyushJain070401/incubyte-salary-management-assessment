import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

// Static option sets. In a richer app these would come from a /metadata
// endpoint; the seed deliberately uses a closed set so hard-coding here
// is honest.
const COUNTRIES = ['US', 'GB', 'IN', 'JP', 'DE', 'FR', 'IT', 'ES'];
const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'Operations'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY'];

export type FilterState = {
  search: string;
  country: string;
  department: string;
  status: string;
  displayCurrency: string;
};

type Props = {
  value: FilterState;
  onChange: (next: FilterState) => void;
  onClear: () => void;
};

export function FilterBar({ value, onChange, onClear }: Props) {
  const update = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });

  const hasAny = Boolean(
    value.search || value.country || value.department || value.status,
  );

  return (
    <div className="flex flex-wrap gap-2 items-end">
      <div className="flex-1 min-w-[200px]">
        <Input
          type="search"
          placeholder="Search name, email, or code…"
          value={value.search}
          onChange={(e) => update({ search: e.target.value })}
        />
      </div>
      <Select
        aria-label="Country"
        value={value.country}
        onChange={(e) => update({ country: e.target.value })}
      >
        <option value="">All countries</option>
        {COUNTRIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Department"
        value={value.department}
        onChange={(e) => update({ department: e.target.value })}
      >
        <option value="">All departments</option>
        {DEPARTMENTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Status"
        value={value.status}
        onChange={(e) => update({ status: e.target.value })}
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="terminated">Terminated</option>
      </Select>
      <Select
        aria-label="Display currency"
        value={value.displayCurrency}
        onChange={(e) => update({ displayCurrency: e.target.value })}
        title="Currency used for sortable salary + dashboard figures"
      >
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            Show {c}
          </option>
        ))}
      </Select>
      {hasAny && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      )}
    </div>
  );
}
