import { forwardRef, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { invalid, className = '', ...rest },
  ref,
) {
  const ringClass = invalid
    ? 'ring-rose-300 focus-visible:ring-rose-500'
    : 'ring-neutral-200 focus-visible:ring-neutral-400';
  return (
    <input
      ref={ref}
      className={
        'block w-full h-10 px-3 rounded-md text-sm bg-white text-neutral-900 ' +
        'ring-1 ring-inset placeholder:text-neutral-400 ' +
        `focus:outline-none focus-visible:ring-2 ${ringClass} ${className}`
      }
      {...rest}
    />
  );
});
