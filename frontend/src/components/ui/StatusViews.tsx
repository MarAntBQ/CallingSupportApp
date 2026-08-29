export const LoadingState = ({ label = 'Cargando…' }: { label?: string }) => (
  <div className="flex items-center gap-2.5 py-10 text-sm text-[var(--text-muted)]">
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
    {label}
  </div>
);

export const ErrorState = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>
);

export const EmptyState = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center rounded-xl border border-dashed border-[var(--border)] py-10 text-sm text-[var(--text-muted)]">
    {message}
  </div>
);
