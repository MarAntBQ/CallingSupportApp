export type DemoRow = {
  id: number;
  name: string;
  email: string;
  organization: DemoOrganization | null;
  registeredOn: string | null;
  slots: number | null;
};

const FIRST = ['Ana', 'Beto', 'Carla', 'Diego', 'Elena', 'Fabio', 'Gina', 'Hugo', 'Inés', 'Julio'];
const LAST = ['Prueba', 'Ejemplo', 'Demo'];
export const ORGANIZATIONS = ['reliefSociety', 'eldersQuorum', 'youngWomen', 'primary'] as const;

export type DemoOrganization = (typeof ORGANIZATIONS)[number];

export const DEMO_ROWS: DemoRow[] = Array.from({ length: 30 }, (_, index) => {
  const first = FIRST[index % FIRST.length]!;
  const last = LAST[index % LAST.length]!;
  const day = String((index * 7) % 28 + 1).padStart(2, '0');
  const month = String((index % 12) + 1).padStart(2, '0');
  return {
    id: index + 1,
    name: `${first} ${last} ${index + 1}`,
    email: `${first.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()}.${last.toLowerCase()}${index + 1}@example.com`,
    organization: ORGANIZATIONS[index % (ORGANIZATIONS.length + 1)] ?? null,
    registeredOn: index % 9 === 4 ? null : `2026-${month}-${day}`,
    slots: index % 11 === 6 ? null : (index * 13) % 40,
  };
});
