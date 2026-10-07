import type { ReactNode } from 'react';

const TONES = {
  info: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function Alert({
  tone = 'info',
  title,
  children,
  role,
}: {
  tone?: keyof typeof TONES;
  title?: string;
  children?: ReactNode;
  role?: 'alert' | 'status';
}) {
  return (
    <div role={role} className="flex gap-3 rounded-md border border-border bg-surface p-4 text-left shadow-sm">
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className={`mt-0.5 size-5 shrink-0 ${TONES[tone]}`}>
        <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-.75 4a.75.75 0 0 1 1.5 0v4.5a.75.75 0 0 1-1.5 0V6Zm.75 8.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
      </svg>
      <div className="flex flex-col gap-1 text-sm text-text">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-text-muted">{children}</div>}
      </div>
    </div>
  );
}
