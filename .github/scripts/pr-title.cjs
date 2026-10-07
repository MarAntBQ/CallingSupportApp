const TYPES = ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'perf'];

const PATTERN = new RegExp(`^(${TYPES.join('|')})(\\(.+\\))?: .+$`);

function isValidTitle(title) {
  return PATTERN.test(String(title ?? ''));
}

module.exports = { TYPES, PATTERN, isValidTitle };
