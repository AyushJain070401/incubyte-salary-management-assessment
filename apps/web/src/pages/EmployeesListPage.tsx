import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

import { FilterBar, type FilterState } from '../components/employees/FilterBar';
import { EmployeesTable } from '../components/employees/EmployeesTable';
import { Pagination } from '../components/employees/Pagination';
import { useEmployeesList, type EmployeeListParams } from '../api/employees';

// Read the current state from URL search params so back/forward + share
// links work without extra plumbing. Defaults match the API defaults.
function paramsFromUrl(search: URLSearchParams): EmployeeListParams {
  const sortBy = search.get('sortBy');
  const sortDir = search.get('sortDir');
  const status = search.get('status');
  const out: EmployeeListParams = {
    page: Math.max(1, Number(search.get('page') ?? 1)),
    perPage: Math.min(200, Math.max(1, Number(search.get('perPage') ?? 50))),
    search: search.get('search') ?? '',
    country: search.get('country') ?? '',
    department: search.get('department') ?? '',
    role: search.get('role') ?? '',
    sortBy:
      sortBy === 'fullName' || sortBy === 'hireDate' || sortBy === 'salary' || sortBy === 'createdAt'
        ? sortBy
        : 'fullName',
    sortDir: sortDir === 'desc' ? 'desc' : 'asc',
    displayCurrency: search.get('displayCurrency') ?? 'USD',
  };
  if (status === 'active' || status === 'terminated') out.status = status;
  return out;
}

export function EmployeesListPage() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => paramsFromUrl(search), [search]);

  const { data, isLoading, isError, error } = useEmployeesList(params);

  const updateSearch = useCallback(
    (mut: (next: URLSearchParams) => void) => {
      setSearch((prev) => {
        const next = new URLSearchParams(prev);
        mut(next);
        // any param change resets to page 1, except the page change itself
        return next;
      });
    },
    [setSearch],
  );

  const filterState: FilterState = {
    search: params.search ?? '',
    country: params.country ?? '',
    department: params.department ?? '',
    status: params.status ?? '',
    displayCurrency: params.displayCurrency,
  };

  function onFilterChange(next: FilterState) {
    updateSearch((s) => {
      s.set('page', '1');
      setOrDelete(s, 'search', next.search);
      setOrDelete(s, 'country', next.country);
      setOrDelete(s, 'department', next.department);
      setOrDelete(s, 'status', next.status);
      s.set('displayCurrency', next.displayCurrency);
    });
  }

  function onFilterClear() {
    updateSearch((s) => {
      s.set('page', '1');
      s.delete('search');
      s.delete('country');
      s.delete('department');
      s.delete('status');
    });
  }

  function onSort(field: 'fullName' | 'hireDate' | 'salary') {
    updateSearch((s) => {
      s.set('page', '1');
      const sameField = params.sortBy === field;
      s.set('sortBy', field);
      s.set('sortDir', sameField && params.sortDir === 'asc' ? 'desc' : 'asc');
    });
  }

  function onPage(page: number) {
    updateSearch((s) => s.set('page', String(page)));
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Employees</h1>
        {data && (
          <span className="text-xs text-neutral-500">
            {data.total.toLocaleString()} total
          </span>
        )}
      </div>

      <FilterBar value={filterState} onChange={onFilterChange} onClear={onFilterClear} />

      {isError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error instanceof Error ? error.message : 'Failed to load employees'}
        </div>
      )}

      <EmployeesTable
        rows={data?.items ?? []}
        loading={isLoading}
        sortBy={(params.sortBy ?? 'fullName') as 'fullName' | 'hireDate' | 'salary'}
        sortDir={params.sortDir ?? 'asc'}
        onSort={onSort}
      />

      {data && data.totalPages > 0 && (
        <Pagination
          page={data.page}
          perPage={data.perPage}
          total={data.total}
          totalPages={data.totalPages}
          onPageChange={onPage}
        />
      )}
    </section>
  );
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}
