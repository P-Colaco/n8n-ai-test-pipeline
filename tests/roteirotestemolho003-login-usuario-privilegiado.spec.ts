import { test, expect } from '@playwright/test';

test.describe('Login com usuário de performance', () => {
  test('Login com credenciais via environment variable', async ({ page }) => {
    const username = process.env.TEST_USERNAME;
    const password = process.env.TEST_PASSWORD;

    if (!username || !password) {
      test.skip(true, 'TEST_USERNAME or TEST_PASSWORD not set — skipping privileged user test');
    }

    // Step 1 - Acessar a URL base configurada no ambiente
    await page.goto('/');

    // Step 2 - Preencher o campo "Username" com credencial injetada via CI secret
    await page.locator('[data-test="username"]').fill(username!);

    // Step 3 - Preencher o campo "Password" com credencial injetada via CI secret
    await page.locator('[data-test="password"]').fill(password!);

    // Step 4 - Clicar no botão "Login"
    await page.locator('[data-test="login-button"]').click();

    // Step 5 - Validar que a tela "Products" foi exibida mesmo com usuário de performance
    await expect(page.locator('[data-test="title"]')).toBeVisible({ timeout: 15000 });

    // Step 6 - Validar que os produtos foram carregados
    await expect(page.locator('[data-test="inventory-list"]')).toBeVisible({ timeout: 15000 });
  });
});
