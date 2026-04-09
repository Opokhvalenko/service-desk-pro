import { expect, test } from '@playwright/test';

/**
 * Smoke E2E for ServiceDesk Pro.
 *
 * Walks the most important happy paths under each of the three staff roles
 * and the requester role to make sure routing, RBAC, and the toolbar nav
 * filtering all still work end-to-end. Does NOT mutate state — read-only.
 */

const ADMIN_EMAIL = 'admin@servicedesk.com';
const AGENT_EMAIL = 'agent@servicedesk.com';
const REQUESTER_EMAIL = 'user@servicedesk.com';
const PASSWORD = 'password123';

async function login(page: import('@playwright/test').Page, email: string): Promise<void> {
  await page.goto('/login');
  // Use role + name (not getByLabel) — Material form field also exposes the
  // "Toggle password visibility" suffix button under the same label scope,
  // which makes getByLabel('Password') ambiguous in strict mode.
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
}

test.describe('Smoke flow', () => {
  test('login page renders the demo account quick-fill buttons', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /servicedesk pro/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /login as admin/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /login as requester/i })).toBeVisible();
  });

  test('admin sees full toolbar nav including admin + reports', async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    const banner = page.getByRole('banner');
    await expect(banner.getByRole('button', { name: 'Tickets', exact: true })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Queue', exact: true })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Reports', exact: true })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Admin', exact: true })).toBeVisible();
  });

  test('agent sees queue + my tickets but not reports/admin', async ({ page }) => {
    await login(page, AGENT_EMAIL);
    const banner = page.getByRole('banner');
    await expect(banner.getByRole('button', { name: /queue/i })).toBeVisible();
    await expect(banner.getByRole('button', { name: /my tickets/i })).toBeVisible();
    await expect(banner.getByRole('button', { name: /^reports$/i })).toHaveCount(0);
    await expect(banner.getByRole('button', { name: /^admin$/i })).toHaveCount(0);
  });

  test('requester sees only dashboard + tickets', async ({ page }) => {
    await login(page, REQUESTER_EMAIL);
    const banner = page.getByRole('banner');
    await expect(banner.getByRole('button', { name: /tickets/i })).toBeVisible();
    await expect(banner.getByRole('button', { name: /^queue$/i })).toHaveCount(0);
    await expect(banner.getByRole('button', { name: /^my tickets$/i })).toHaveCount(0);
    await expect(banner.getByRole('button', { name: /^reports$/i })).toHaveCount(0);
    await expect(banner.getByRole('button', { name: /^admin$/i })).toHaveCount(0);
  });
});
