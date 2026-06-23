import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ImportReport, ImportCommitResult } from '@acme/shared';

import { apiFetch } from './client';

export function useDryRunImport() {
  return useMutation({
    mutationFn: (csv: string) =>
      apiFetch<ImportReport>('/api/import/employees?mode=dry-run', {
        method: 'POST',
        headers: { 'content-type': 'text/csv' },
        body: csv,
      }),
  });
}

export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) =>
      apiFetch<ImportCommitResult>('/api/import/employees?mode=commit', {
        method: 'POST',
        headers: { 'content-type': 'text/csv' },
        body: csv,
      }),
    onSuccess: () => {
      // New employees are now in the system — refresh everything.
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
