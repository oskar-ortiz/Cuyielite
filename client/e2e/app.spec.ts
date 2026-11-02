import { expect, test } from '@playwright/test';

test('la raíz redirige al listado de galpones', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/galpones$/);
  await expect(page.getByText('Galpón Norte')).toBeVisible();
});

test('un galpón sin pozas muestra el mensaje de estado vacío', async ({ page }) => {
  await page.goto('/galpones/00000000-0000-4000-8000-000000000004');
  await expect(page.getByText('todavía no tiene pozas')).toBeVisible();
});
