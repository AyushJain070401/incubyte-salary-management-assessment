import { useQuery } from '@tanstack/react-query';
import type { AnalyticsResponse } from '@acme/shared';

import { apiFetch } from './client';

export type AnalyticsParams = {
  search?: string;
  country?: string;
  department?: string;
  role?: string;
  status?: 'active' | 'terminated';
  displayCurrency: string;
};

function buildQuery(p: AnalyticsParams): string {
  const u = new URLSearchParams();
  u.set('displayCurrency', p.displayCurrency);
  if (p.search) u.set('search', p.search);
  if (p.country) u.set('country', p.country);
  if (p.department) u.set('department', p.department);
  if (p.role) u.set('role', p.role);
  if (p.status) u.set('status', p.status);
  return u.toString();
}

export function useAnalytics(params: AnalyticsParams) {
  return useQuery({
    queryKey: ['analytics', params],
    queryFn: () => apiFetch<AnalyticsResponse>(`/api/analytics?${buildQuery(params)}`),
    placeholderData: (prev) => prev,
  });
}
