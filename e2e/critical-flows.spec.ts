import { randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { Secret, TOTP } from 'otpauth';
import en from '../messages/en.json';
import es from '../messages/es.json';
import pt from '../messages/pt.json';

const EMAIL = 'ana.prueba@example.com';
const PASSWORD = randomBytes(12).toString('hex');

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'la página se desborda horizontalmente').toBeLessThanOrEqual(0);
}

// Verificación en dos pasos (#36): el SuperAdmin la activa en /setup y cada login pide el código.
// El servidor rechaza un paso de tiempo ya usado, así que cada código sale de un paso nuevo.
const STEP_MS = 30_000;
let mfaSecret = '';
let lastStep = -1;

async function nextTotp() {
  for (;;) {
    const now = Date.now();
    const current = Math.floor(now / STEP_MS);
    const earliest = now % STEP_MS < STEP_MS - 10_000 ? current - 1 : current;
    const step = Math.max(lastStep + 1, earliest);
    if (step <= current + 1) {
      lastStep = step;
      return new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(mfaSecret) }).generate({ timestamp: step * STEP_MS });
    }
    await new Promise((resolve) => setTimeout(resolve, (current + 1) * STEP_MS - now + 100));
  }
}

async function login(page: Page, password: string) {
  await page.goto('/login');
  await page.getByLabel(es.login.email).fill(EMAIL);
  await page.getByLabel(es.login.password, { exact: true }).fill(password);
  await page.getByRole('button', { name: es.login.submit }).click();
  if (password !== PASSWORD) return;
  await expect(page.getByTestId('mfa-step')).toBeVisible();
  await page.getByLabel(es.login.mfa.code).fill(await nextTotp());
  await page.getByRole('button', { name: es.login.mfa.submit }).click();
}

// 90 s por prueba: un login puede esperar al siguiente paso de 30 s del código (nextTotp).
test.describe.configure({ mode: 'serial', timeout: 90_000 });

test.beforeAll(async ({ request }) => {
  const response = await request.get('/api/setup');
  expect(await response.json(), 'la E2E necesita una base vacía: el primer paso crea el primer administrador').toEqual({ needed: true });
});

test('sin administrador, /admin y /login llevan a /setup', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/setup$/);
  await page.goto('/login');
  await expect(page).toHaveURL(/\/setup$/);
});

test('/setup crea el primer SuperAdmin y entra al panel', async ({ page }) => {
  await page.goto('/setup');
  await page.getByRole('radio', { name: es.setup.ward }).check();
  await page.getByLabel(es.setup.unitName).fill('Barrio de Prueba');
  await page.getByLabel(es.setup.contact).fill('barrio.prueba@example.com');
  await page.getByLabel(es.setup.firstName).fill('Ana');
  await page.getByLabel(es.setup.lastName).fill('Prueba');
  await page.getByLabel(es.setup.email, { exact: true }).fill(EMAIL);
  await page.getByLabel(es.setup.password, { exact: true }).fill(PASSWORD);
  await page.getByLabel(es.setup.confirmPassword).fill(PASSWORD);
  await page.getByLabel(es.setup.bishopApproved.ward).check();
  await page.getByLabel(es.setup.bishopApprovedBy).fill('Obispo de prueba');
  await page.getByLabel(es.setup.bishopApprovedOn).fill('2026-10-01');
  await page.getByLabel(es.setup.privacy.consent).check();
  await page.getByRole('button', { name: es.setup.submit }).click();
  await expect(page.getByTestId('unit-name')).toHaveText('Barrio de Prueba');
  await expect(page.locator('footer')).toContainText('barrio.prueba@example.com');

  // El SuperAdmin no entra al panel sin la verificación en dos pasos: lo lleva a activarla.
  await expect(page).toHaveURL(/\/admin\/profile\/security$/);
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/admin\/profile\/security$/);
  await page.getByRole('button', { name: es.security.enable }).click();
  mfaSecret = (await page.getByTestId('mfa-secret').textContent())!.trim();
  await page.getByLabel(es.security.code).fill(await nextTotp());
  await page.getByRole('button', { name: es.security.confirm }).click();
  const codes = page.getByTestId('recovery-codes').getByRole('listitem');
  await expect(codes).toHaveCount(10);
  await expect(page.getByRole('button', { name: es.security.finish })).toBeDisabled();
  await page.getByLabel(es.security.savedCheck).check();
  await page.getByRole('button', { name: es.security.finish }).click();
  await expect(page.getByTestId('mfa-status')).toContainText(es.security.on);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
});

test('después del primer administrador, /setup redirige a /login', async ({ page }) => {
  await page.goto('/setup');
  await expect(page).toHaveURL(/\/login$/);
});

test('/admin sin sesión redirige a /login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
});

test('login con contraseña mala muestra el error y con la buena entra; cerrar sesión vuelve a /login', async ({ page }) => {
  await login(page, `${PASSWORD}x`);
  await expect(page.getByText(es.errors.invalid_credentials)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  await login(page, PASSWORD);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  await page.getByRole('button', { name: es.admin.logout }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
});

test('Verificación en dos pasos: a 360 px el paso del código cabe, pide teclado numérico y rechaza un código malo', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/login');
  await page.getByLabel(es.login.email).fill(EMAIL);
  await page.getByLabel(es.login.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: es.login.submit }).click();
  const code = page.getByLabel(es.login.mfa.code);
  await expect(code).toBeVisible();
  await expect(code).toHaveAttribute('inputmode', 'numeric');
  await expect(code).toHaveAttribute('autocomplete', 'one-time-code');
  await expectNoHorizontalOverflow(page);
  await code.fill('000000');
  await page.getByRole('button', { name: es.login.mfa.submit }).click();
  await expect(page.getByText(es.login.mfa.incorrect)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await code.fill(await nextTotp());
  await page.getByRole('button', { name: es.login.mfa.submit }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expectNoHorizontalOverflow(page);
});

test('Configuración: cambiar el nombre se ve en la barra lateral sin recargar', async ({ page }) => {
  await login(page, PASSWORD);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await page.getByRole('link', { name: es.admin.nav.settings }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await page.getByLabel(es.settings.general.unitName).fill('Barrio Los Pinos');
  await page.locator('form').first().getByRole('button', { name: es.settings.save }).click();
  await expect(page.getByText(es.settings.saved)).toBeVisible();
  await expect(page.getByTestId('unit-name')).toHaveText('Barrio Los Pinos');
});

test('Organizaciones: el catálogo arranca vacío y el SuperAdmin agrega la primera organización y su llamamiento', async ({ page }) => {
  const t = es.organizations;
  await login(page, PASSWORD);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await page.getByRole('link', { name: es.admin.nav.organizations }).click();
  await expect(page).toHaveURL(/\/admin\/organizations$/);
  await expect(page.getByText(t.empty)).toBeVisible();

  await page.getByLabel(t.newOrganization).fill('Presidencia de rama');
  await page.getByRole('button', { name: t.add, exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Presidencia de rama' })).toBeVisible();
  await expect(page.getByText(t.empty)).toHaveCount(0);

  await page.getByLabel(t.newOrganization).fill('presidencia de rama');
  await page.getByRole('button', { name: t.add, exact: true }).first().click();
  await expect(page.getByText(t.errors.organizationTaken)).toBeVisible();

  const callingField = page.getByLabel(t.newCalling.replace('{organization}', 'Presidencia de rama'));
  await callingField.fill('Secretario');
  await page.locator('form').filter({ has: callingField }).getByRole('button', { name: t.add, exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Secretario' })).toBeVisible();

  await page.getByRole('button', { name: t.deactivateItem.replace('{name}', 'Presidencia de rama') }).click();
  await expect(page.getByText(t.callingsEmpty)).toBeVisible();
  await page.getByRole('button', { name: t.activateItem.replace('{name}', 'Presidencia de rama') }).click();
  await expect(page.getByRole('heading', { name: 'Presidencia de rama' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  await expectNoHorizontalOverflow(page);
});

test('Permisos: el SuperAdmin marca "Editar" en un módulo y queda guardado tras recargar', async ({ page }) => {
  const t = es.organizations.permissions;
  const label = t.checkbox
    .replace('{action}', t.columns.canUpdate)
    .replace('{calling}', 'Secretario')
    .replace('{organization}', 'Presidencia de rama');
  await login(page, PASSWORD);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await page.getByRole('link', { name: es.admin.nav.organizations }).click();
  await expect(page).toHaveURL(/\/admin\/organizations$/);

  // la matriz muestra el módulo "Organizaciones y llamamientos" con el llamamiento activo
  const section = page.locator('details[data-module="callings"]');
  await expect(section).toBeVisible();
  await section.locator('summary').click();
  const editar = page.getByRole('checkbox', { name: label });
  await expect(editar).not.toBeChecked();
  // el checkbox es controlado y optimista: click + aserción web-first en vez de check()
  // (check() exige el cambio de estado síncrono y pelea con el re-render de React)
  await editar.click();
  await expect(editar).toBeChecked();
  await expect(page.getByText(t.saved)).toBeVisible();

  // persiste tras recargar: la verificación real del permiso vive en el servidor
  await page.reload();
  await page.locator('details[data-module="callings"] summary').click();
  await expect(page.getByRole('checkbox', { name: label })).toBeChecked();

  // a 390 px la página no se desborda (la tabla ancha va en su propio scroll)
  await page.setViewportSize({ width: 390, height: 900 });
  await expectNoHorizontalOverflow(page);
});

test('Viaje al Templo: el SuperAdmin crea un viaje y aparece en el panel', async ({ page }) => {
  const tt = es.templeTrips;
  await login(page, PASSWORD);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await page.getByRole('link', { name: es.admin.nav.templeTrips }).click();
  await expect(page).toHaveURL(/\/admin\/temple-trips$/);
  await expect(page.getByText(tt.empty)).toBeVisible();

  await page.getByRole('button', { name: tt.newTrip }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(tt.fields.templeName, { exact: true }).fill('Templo de Guayaquil Ecuador');
  await dialog.getByLabel(tt.fields.date, { exact: true }).fill('2026-12-20');
  await dialog.getByLabel(tt.fields.registrationDeadline, { exact: true }).fill('2026-12-01');
  await dialog.getByRole('button', { name: tt.save }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Templo de Guayaquil Ecuador')).toBeVisible();
  await expect(page.getByText(tt.empty)).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 900 });
  await expectNoHorizontalOverflow(page);
});

test('Viaje al Templo (público): el SuperAdmin activa un viaje y un miembro se inscribe', async ({ page }) => {
  // Activa el viaje creado antes (programado con el templo + activo).
  await login(page, PASSWORD);
  await page.getByRole('link', { name: es.admin.nav.templeTrips }).click();
  await expect(page).toHaveURL(/\/admin\/temple-trips$/);
  await page.getByRole('button', { name: es.templeTrips.editTrip }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: es.templeTrips.fields.scheduledWithTemple }).click();
  await dialog.getByRole('checkbox', { name: es.templeTrips.fields.active }).click();
  await dialog.getByRole('button', { name: es.templeTrips.save }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(es.templeTrips.badges.active)).toBeVisible();
  await page.getByRole('button', { name: es.admin.logout }).click();
  await expect(page).toHaveURL(/\/login/);

  // Inscripción pública (sin sesión): `/` redirige a `/temple-trip`.
  const tp = es.templeTrips.public;
  await page.goto('/');
  await expect(page).toHaveURL(/\/temple-trip$/);
  await expect(page.getByRole('heading', { name: tp.title })).toBeVisible();
  await page.getByLabel(tp.fields.idNumber, { exact: true }).fill('1710034065');
  await page.getByLabel(tp.fields.birthDate, { exact: true }).fill('1990-05-10');
  await page.getByLabel(tp.fields.fullName, { exact: true }).fill('Persona Prueba');
  await page.getByLabel(tp.fields.phone, { exact: true }).fill('+593999999999');
  await page.getByLabel(tp.fields.email, { exact: true }).fill('persona@example.com');
  await page.getByLabel(tp.fields.gender, { exact: true }).selectOption('male');
  await page.getByRole('checkbox', { name: tp.consent }).check();
  await page.getByRole('button', { name: tp.submit }).click();
  await expect(page.getByText(tp.success)).toBeVisible();

  await page.setViewportSize({ width: 390, height: 900 });
  await expectNoHorizontalOverflow(page);
});

test('Viaje al Templo: el SuperAdmin aprueba un participante en el panel', async ({ page }) => {
  const tp = es.templeTrips.participants;
  await login(page, PASSWORD);
  await page.getByRole('link', { name: es.admin.nav.templeTrips }).click();
  await expect(page).toHaveURL(/\/admin\/temple-trips$/);
  // El viaje activo está seleccionado por defecto y el panel abre en "Pendientes".
  await expect(page.getByRole('button', { name: 'Persona Prueba' })).toBeVisible();
  await page.getByRole('button', { name: tp.actions.approve, exact: true }).first().click();
  // Tras aprobar sale de Pendientes; en "Aprobados" aparece.
  await page.getByRole('tab', { name: tp.subtabs.approved }).click();
  await expect(page.getByRole('button', { name: 'Persona Prueba' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  await expectNoHorizontalOverflow(page);
});

test('Viaje al Templo: Reportes muestra el resumen e imprime solo la lista', async ({ page }) => {
  const tt = es.templeTrips;
  const tr = tt.reports;
  await login(page, PASSWORD);
  await page.getByRole('link', { name: es.admin.nav.templeTrips }).click();
  await expect(page).toHaveURL(/\/admin\/temple-trips$/);
  await page.getByRole('tab', { name: tt.tabs.reports }).click();

  // Resumen y aviso de datos de miembros.
  await expect(page.getByText(tr.dataNotice)).toBeVisible();
  await expect(page.getByText(tr.estimatedCost.label)).toBeVisible();
  await expect(page.getByText(tr.estimatedCost.note)).toBeVisible();

  // La vista general lista al participante aprobado dentro del área imprimible.
  await expect(page.locator('.print-area')).toContainText('Persona Prueba');

  // Impresión: en media 'print' solo queda el área de la lista; el resumen (.no-print) se oculta.
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('tab', { name: tr.filter.approvedOnly })).toBeHidden();
  await expect(page.locator('.print-area')).toBeVisible();
  await page.screenshot({ path: 'test-results/reportes-vista-general-print.png' });
  await page.emulateMedia({ media: 'screen' });

  await page.setViewportSize({ width: 390, height: 900 });
  await expectNoHorizontalOverflow(page);
});

test('/privacy: sin responsable lo avisa; al configurarlo en Configuración aparece sin redeploy', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(es.privacyPolicy.title);
  await expect(page.getByText(es.privacyPolicy.missingController)).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(17);

  await login(page, PASSWORD);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await page.goto('/admin/settings');
  await page.getByLabel(es.settings.controller.name, { exact: true }).fill('Obispado de prueba');
  await page.getByLabel(es.settings.controller.email, { exact: true }).fill('obispado.prueba@example.com');
  await page.getByLabel(es.settings.controller.phone, { exact: true }).fill('+593 2 000 0000');
  await page.getByLabel(es.settings.controller.address).fill('Av. de Prueba 123');
  await page.getByLabel(es.settings.controller.city).fill('Quito, Ecuador');
  await page.getByLabel(es.settings.controller.retentionMonths).fill('6');
  await page.locator('form').nth(1).getByRole('button', { name: es.settings.save }).click();
  await expect(page.locator('form').nth(1).getByText(es.settings.saved)).toBeVisible();

  await page.goto('/privacy');
  await expect(page.getByText(es.privacyPolicy.missingController)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'obispado.prueba@example.com' }).first()).toHaveAttribute('href', 'mailto:obispado.prueba@example.com');
  await expect(page.getByText('Quito, Ecuador')).toBeVisible();
  await expect(page.getByText(/Domicilio: Av\. de Prueba 123\. Teléfono: \+593 2 000 0000\./)).toBeVisible();
  await expect(page.getByText(/^6 meses desde la inscripción/)).toBeVisible();
  await expect(page.getByTestId('policy-subtitle')).toContainText('Barrio Los Pinos');
  await page.locator('footer').getByRole('link', { name: es.common.privacyLink }).click();
  await expect(page).toHaveURL(/\/privacy$/);
});

for (const [locale, messages] of [
  ['pt', pt],
  ['en', en],
] as const) {
  test(`/login en ${locale}: lang y textos del idioma`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'csa_locale', value: locale, url: baseURL! }]);
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages.login.title);
  });
}

test.describe('teléfono (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const path of ['/', '/login', '/privacy']) {
    test(`${path} no se desborda`, async ({ page }) => {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    });
  }

  test('/admin/emails: un envío fallido queda registrado y la tabla no desborda la página', async ({ page }) => {
    await login(page, PASSWORD);
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    const status = await page.evaluate(async (to) => {
      const response = await fetch('/api/config/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
      return response.status;
    }, EMAIL);
    expect(status).toBe(400);
    await page.goto('/admin/emails');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(es.mailLogs.title);
    await expect(page.locator('tbody tr').first()).toContainText(es.mailLogs.failed);
    await expectNoHorizontalOverflow(page);
  });

  test('/admin/settings no se desborda', async ({ page }) => {
    await login(page, PASSWORD);
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await page.goto('/admin/settings');
    await expectNoHorizontalOverflow(page);
  });
});
