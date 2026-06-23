import { forwardRef, type SelectHTMLAttributes } from 'react';

type Props = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { className = '', children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={
        'block h-10 px-3 pr-8 rounded-md text-sm bg-white text-neutral-900 ' +
        'ring-1 ring-inset ring-neutral-200 focus:outline-none ' +
        `focus-visible:ring-2 focus-visible:ring-neutral-400 ${className}`
      }
      {...rest}
    >
      {children}
    </select>
  );
});
