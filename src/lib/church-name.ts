const OFFICIAL_NAMES = [
  'La Iglesia de Jesucristo de los Santos de los Últimos Días',
  'A Igreja de Jesus Cristo dos Santos dos Últimos Dias',
  'The Church of Jesus Christ of Latter-day Saints',
  'Iglesia de Jesucristo',
  'Igreja de Jesus Cristo',
  'Church of Jesus Christ',
  'Santos de los Últimos Días',
  'Santos dos Últimos Dias',
  'Latter-day Saints',
  'SUD',
  'LDS',
];

const HOMOGLYPHS: Record<string, string> = {
  а: 'a', в: 'b', с: 'c', е: 'e', ё: 'e', һ: 'h', і: 'i', ї: 'i', ј: 'j', к: 'k', м: 'm', н: 'h',
  о: 'o', р: 'p', ѕ: 's', т: 't', у: 'y', х: 'x', ԁ: 'd', ԛ: 'q', ԝ: 'w',
  α: 'a', β: 'b', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', γ: 'y',
};

function normalize(text: string) {
  return text
    .normalize('NFKD')
    .replace(/\p{Cf}/gu, '')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\u0000-\u007f]/g, (char) => HOMOGLYPHS[char] ?? ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const NORMALIZED = OFFICIAL_NAMES.map(normalize);

export function containsOfficialChurchName(text: string) {
  const value = ` ${normalize(text)} `;
  return NORMALIZED.some((name) => value.includes(` ${name} `));
}
