const TYPES = ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'perf'];

const PATTERN = new RegExp(`^(${TYPES.join('|')})(\\([^()\\s][^()]*\\))?: \\S.*$`);

function isValidTitle(title) {
  return PATTERN.test(String(title ?? '').trim());
}

module.exports = { TYPES, PATTERN, isValidTitle };

if (require.main === module) {
  const title = process.env.PR_TITLE ?? '';
  if (isValidTitle(title)) {
    console.log('Título válido.');
  } else {
    console.error(
      `El título del PR tiene que empezar con un tipo: ${TYPES.join(', ')}. Ejemplo: "fix: corrige el orden de la tabla". ` +
        'El squash usa el título como mensaje del commit en main (AGENTS.md, regla dura 11).',
    );
    process.exit(1);
  }
}
