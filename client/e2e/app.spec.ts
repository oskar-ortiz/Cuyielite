import { expect, test } from '@playwright/test';

test('la raíz permite elegir el modo de demostración', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Elegir modo')).toBeVisible();
  await page.getByText('Entrar a demostración').click();
  await expect(page).toHaveURL(/\/galpones$/);
  await expect(page.getByText('Datos de demostración')).toBeVisible();
});

test('el modo trabajo muestra que requiere una aplicación nativa', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Entrar a trabajo').click();
  await expect(page).toHaveURL(/\/trabajo\/galpones$/);
  await expect(page.getByText('Base de trabajo · solo consulta')).toBeVisible();
  await expect(page.getByText(/requiere Android o Windows instalado/)).toBeVisible();
  await expect(page.getByText('Nuevo')).toHaveCount(0);
});
