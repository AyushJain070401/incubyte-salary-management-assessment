import { Button } from '../ui/Button';

type Props = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, perPage, total, totalPages, onPageChange }: Props) {
  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  return (
    <div className="flex items-center justify-between text-xs text-neutral-600">
      <span>
        {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          ‹ Prev
        </Button>
        <span className="px-2">
          Page {page.toLocaleString()} of {totalPages.toLocaleString()}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next ›
        </Button>
      </div>
    </div>
  );
}
