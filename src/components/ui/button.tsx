import type { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'link' };

const VARIANTS = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-strong disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed',
  secondary:
    'border border-primary text-primary hover:border-primary-strong hover:text-primary-strong disabled:border-border disabled:text-text-muted disabled:cursor-not-allowed',
  link: 'text-primary underline-offset-4 hover:text-primary-strong hover:underline',
};

export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  const shape = variant === 'link' ? 'px-1 py-1' : 'rounded-sm px-4 py-2';
  return (
    <button
      type={type}
      className={`${shape} inline-flex items-center justify-center gap-2 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${VARIANTS[variant]} ${className ?? ''}`}
      {...props}
    />
  );
}
