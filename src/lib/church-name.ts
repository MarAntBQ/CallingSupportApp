const OFFICIAL_NAMES = [
  'La Iglesia de Jesucristo de los Santos de los Últimos Días',
  'A Igreja de Jesus Cristo dos Santos dos Últimos Dias',
  'The Church of Jesus Christ of Latter-day Saints',
  'Iglesia de Jesucristo',
  'Igreja de Jesus Cristo',
  'Church of Jesus Christ',
];

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const NORMALIZED = OFFICIAL_NAMES.map(normalize);

export function containsOfficialChurchName(text: string) {
  const value = ` ${normalize(text)} `;
  return NORMALIZED.some((name) => value.includes(` ${name} `));
}
