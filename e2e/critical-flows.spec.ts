import { randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import en from '../messages/en.json';
import es from '../messages/es.json';
import pt from '../messages/pt.json';

const EMAIL = 'ana.prueba@example.com';
const PASSWORD = randomBytes(12).toString('hex');

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'la página se desborda horizontalmente').toBeLessThanOrEqual(0);
}

async function login(page: Page, password: string) {
  await page.goto('/login');
  await page.getByLabel(es.login.email).fill(EMAIL);
  await page.getByLabel(es.login.password, { exact: true }).fill(password);
  await page.getByRole('button', { name: es.login.submit }).click();
}

test.describe.configure({ mode: 'serial' });

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
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId('unit-name')).toHaveText('Barrio de Prueba');
  await expect(page.locator('footer')).toContainText('barrio.prueba@example.com');
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
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole('button', { name: es.admin.logout }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
});

test('Configuración: cambiar el nombre se ve en la barra lateral sin recargar', async ({ page }) => {
  await login(page, PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: es.admin.nav.settings }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await page.getByLabel(es.settings.general.unitName).fill('Barrio Los Pinos');
  await page.locator('form').first().getByRole('button', { name: es.settings.save }).click();
  await expect(page.getByText(es.settings.saved)).toBeVisible();
  await expect(page.getByTestId('unit-name')).toHaveText('Barrio Los Pinos');
});

test('/privacy: sin responsable lo avisa; al configurarlo en Configuración aparece sin redeploy', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(es.privacyPolicy.title);
  await expect(page.getByText(es.privacyPolicy.missingController)).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(17);

  await login(page, PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/settings');
  await page.getByLabel(es.settings.controller.name, { exact: true }).fill('Obispado de prueba');
  await page.getByLabel(es.settings.controller.email, { exact: true }).fill('obispado.prueba@example.com');
  await page.getByLabel(es.settings.controller.city).fill('Quito, Ecuador');
  await page.getByLabel(es.settings.controller.retentionMonths).fill('6');
  await page.locator('form').nth(1).getByRole('button', { name: es.settings.save }).click();
  await expect(page.locator('form').nth(1).getByText(es.settings.saved)).toBeVisible();

  await page.goto('/privacy');
  await expect(page.getByText(es.privacyPolicy.missingController)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'obispado.prueba@example.com' }).first()).toHaveAttribute('href', 'mailto:obispado.prueba@example.com');
  await expect(page.getByText('Quito, Ecuador')).toBeVisible();
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

  test('/admin/settings no se desborda', async ({ page }) => {
    await login(page, PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/settings');
    await expectNoHorizontalOverflow(page);
  });
});
