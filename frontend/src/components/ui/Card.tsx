import type { ReactNode } from 'react';

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 ${className}`}>{children}</div>
);
