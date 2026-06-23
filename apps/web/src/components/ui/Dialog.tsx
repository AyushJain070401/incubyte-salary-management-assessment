import { useEffect, useRef, type ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

// Minimal modal built on the native <dialog> element + Tailwind. The
// element handles focus trap, escape-to-close, and inert backdrop for
// free. We re-emit close as an onClose prop so callers can keep state.
export function Dialog({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onClose();
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className="rounded-lg p-0 backdrop:bg-neutral-900/40 w-full max-w-md"
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-neutral-400 hover:text-neutral-700 text-lg leading-none"
        >
          ×
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
