import { useId, type ReactNode } from 'react';

export function Card({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5 rounded-md border border-border bg-surface p-5 shadow-md sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-lg font-semibold text-text">
          {title}
        </h2>
        {intro && <p className="text-sm text-text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}
