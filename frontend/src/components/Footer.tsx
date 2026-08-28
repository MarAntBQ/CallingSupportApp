import { Link } from 'react-router-dom';

export const Footer = () => (
  <footer className="mx-auto max-w-2xl px-4 pb-8 pt-4 text-center text-xs text-[var(--text-muted)]">
    <p>
      <Link to="/politica-datos" className="underline hover:text-[var(--sage-600)]">
        Política de Protección de Datos Personales
      </Link>
    </p>
    <p className="mt-2">
      Developed by{' '}
      <a
        href="https://MarAntBQ.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline hover:text-[var(--sage-600)]"
      >
        Marco Antonio Bustillos Quiroz
      </a>
    </p>
  </footer>
);
