import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EmployeeRead, Paginated, SalaryRead, RaiseInput } from '@acme/shared';

import { apiFetch } from './client';

export type EmployeeListParams = {
  page: number;
  perPage: number;
  search?: string;
  country?: string;
  department?: string;
  role?: string;
  status?: 'active' | 'terminated';
  sortBy?: 'fullName' | 'hireDate' | 'salary' | 'createdAt';
  sortDir?: 'asc' | 'desc';
  displayCurrency: string;
};

function buildQuery(p: EmployeeListParams): string {
  const u = new URLSearchParams();
  u.set('page', String(p.page));
  u.set('perPage', String(p.perPage));
  u.set('displayCurrency', p.displayCurrency);
  if (p.search) u.set('search', p.search);
  if (p.country) u.set('country', p.country);
  if (p.department) u.set('department', p.department);
  if (p.role) u.set('role', p.role);
  if (p.status) u.set('status', p.status);
  if (p.sortBy) u.set('sortBy', p.sortBy);
  if (p.sortDir) u.set('sortDir', p.sortDir);
  return u.toString();
}

export function useEmployeesList(params: EmployeeListParams) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => apiFetch<Paginated<EmployeeRead>>(`/api/employees?${buildQuery(params)}`),
    placeholderData: (prev) => prev,
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: () => apiFetch<EmployeeRead>(`/api/employees/${id}`),
    enabled: !!id,
  });
}

export function useSalaryHistory(id: string | undefined) {
  return useQuery({
    queryKey: ['employee', id, 'salaries'],
    queryFn: () => apiFetch<{ items: SalaryRead[] }>(`/api/employees/${id}/salaries`),
    enabled: !!id,
  });
}

export function useGiveRaise(employeeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RaiseInput) =>
      apiFetch<SalaryRead>(`/api/employees/${employeeId}/raise`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      // Refresh the detail page (current salary changed) + history (new row)
      // + list (display salary changed) + analytics (aggregates changed).
      qc.invalidateQueries({ queryKey: ['employee', employeeId] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
