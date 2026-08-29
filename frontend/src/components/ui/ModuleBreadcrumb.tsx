export const ModuleBreadcrumb = ({ modulo, submodulo }: { modulo: string; submodulo: string }) => (
  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
    {modulo} <span className="mx-1 text-[var(--border)]">/</span> {submodulo}
  </p>
);
