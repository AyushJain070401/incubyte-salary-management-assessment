import type { LabelHTMLAttributes } from 'react';

export function Label({
  className = '',
  ...rest
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`block text-xs font-medium text-neutral-700 mb-1.5 ${className}`}
      {...rest}
    />
  );
}
