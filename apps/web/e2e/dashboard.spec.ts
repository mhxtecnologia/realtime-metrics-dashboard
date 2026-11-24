import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Critérios WCAG até a versão 2.2, níveis A e AA.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function waitUntilLive(page: Page) {
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-status', 'live', { timeout: 15_000 });
  await expect(page.getByTestId('kpi-onlineUsers').locator('dd')).not.toHaveText('—');
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

async function openAllTables(page: Page) {
  for (const summary of await page.getByText('Show data table').all()) await summary.click();
  await expect(page.getByRole('table')).toHaveCount(4);
}

test('streams live data into KPIs, charts and the text summary', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Realtime metrics' })).toBeVisible();
  await waitUntilLive(page);

  await expect(page.getByTestId('live-summary')).toContainText('users online');
  await expect(page.getByRole('img', { name: /Checkout latency chart, last \d+ samples/ })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Connection live');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`has no WCAG 2.2 AA violations in the ${colorScheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await waitUntilLive(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
    await openAllTables(page);
    await expectNoAxeViolations(page);
  });
}

test('is fully operable with the keyboard', async ({ page }) => {
  await page.goto('/');
  await waitUntilLive(page);

  // Primeiro Tab: link para pular ao conteúdo, visível e com contorno de foco.
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();
  expect(await skipLink.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');

  // Botão de pausa pelo teclado.
  const pause = page.getByRole('button', { name: 'Pause updates' });
  await pause.focus();
  await page.keyboard.press('Enter');
  await expect(pause).toHaveAttribute('aria-pressed', 'true');

  // Tema: rádios nativos, as setas trocam a opção marcada.
  await page.getByRole('radio', { name: 'System' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Tabela alternativa: o <summary> abre com Enter.
  const summary = page.getByText('Show data table').first();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('table').first()).toBeVisible();
});

test('pausing freezes the dashboard until resumed', async ({ page }) => {
  await page.goto('/');
  await waitUntilLive(page);

  await page.getByRole('button', { name: 'Pause updates' }).click();
  await expect(page.getByTestId('live-summary')).toContainText('Updates paused.');
  const frozen = await page.getByRole('img', { name: /Sales per minute chart/ }).getAttribute('aria-label');
  // O servidor do e2e emite a cada 500 ms: três amostras chegam nesse intervalo.
  await page.waitForTimeout(1500);
  await expect(page.getByRole('img', { name: /Sales per minute chart/ })).toHaveAttribute('aria-label', frozen ?? '');

  await page.getByRole('button', { name: 'Pause updates' }).click();
  await expect(page.getByRole('img', { name: /Sales per minute chart/ })).not.toHaveAttribute(
    'aria-label',
    frozen ?? '',
  );
});

test('stops animations when the user prefers reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await waitUntilLive(page);

  await expect(page.locator('main')).toHaveAttribute('data-reduced-motion', 'true');
  const dot = page.getByTestId('connection-status').locator('.status-dot');
  expect(await dot.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});

test('animates the live indicator when motion is allowed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await waitUntilLive(page);

  await expect(page.locator('main')).toHaveAttribute('data-reduced-motion', 'false');
  const dot = page.getByTestId('connection-status').locator('.status-dot');
  expect(await dot.evaluate((el) => getComputedStyle(el).animationName)).toBe('pulse');
});

test('shows and announces offline, then reconnects when the network returns', async ({ page, context }) => {
  await page.goto('/');
  await waitUntilLive(page);

  await context.setOffline(true);
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-status', 'offline');
  await expect(page.getByRole('status')).toHaveText('Connection offline');

  await context.setOffline(false);
  await waitUntilLive(page);
  await expect(page.getByRole('status')).toHaveText('Connection live');
});

test('sends a strict Content-Security-Policy', async ({ page }) => {
  const response = await page.goto('/');
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("script-src 'self' 'nonce-");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain('connect-src');
});
