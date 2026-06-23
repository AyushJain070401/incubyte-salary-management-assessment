import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

type Health = { status: 'ok'; uptime: number };

export function ApiHealth() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<Health>('/health'),
    refetchInterval: 10_000,
  });

  if (isLoading) return <Pill tone="neutral">api: checking…</Pill>;
  if (isError || data?.status !== 'ok') return <Pill tone="bad">api: unreachable</Pill>;
  return <Pill tone="good">api: ok ({Math.round(data.uptime)}s)</Pill>;
}

function Pill({
  tone,
  children,
}: {
  tone: 'good' | 'bad' | 'neutral';
  children: React.ReactNode;
}) {
  const styles = {
    good: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    bad: 'bg-rose-50 text-rose-700 ring-rose-200',
    neutral: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${styles}`}
    >
      {children}
    </span>
  );
}
