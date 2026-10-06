import { UNDER_CONSTRUCTION } from '@/lib/placeholder-text';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold text-brown-700">CallingSupportApp</h1>
      <ul className="space-y-1 text-text-muted">
        {UNDER_CONSTRUCTION.map(({ lang, text }) => (
          <li key={lang} lang={lang}>
            {text}
          </li>
        ))}
      </ul>
      <p className="rounded-full border border-border bg-surface px-4 py-1 text-sm text-sage-600">
        <a href="https://callingsupportapp.org" className="underline-offset-4 hover:underline">
          callingsupportapp.org
        </a>
      </p>
    </main>
  );
}
