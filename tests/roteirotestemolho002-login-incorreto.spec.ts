import { test, expect } from '@playwright/test';

test.describe('Login incorreto', () => {
  test('Login incorreto', async ({ page }) => {
    // Step 1 - Acessar a URL da tela
    await page.goto('https://www.saucedemo.com/');

    // Step 2 - Preencher o campo "Username" com o login
    await page.locator('[data-test="username"]').fill('standard_user');

    // Step 3 - Preencher o campo "Password" com a senha ERRADA
    await page.locator('[data-test="password"]').fill('senhaerrada123');

    // Step 4 - Clicar no botão "Login"
    await page.locator('[data-test="login-button"]').click();

    // Step 5 - Validar que o login NÃO ocorreu e uma mensagem de erro foi exibida
    await expect(page.locator('[data-test="error"]')).toBeVisible();
    await expect(page.locator('[data-test="error"]')).toContainText(
      'Username and password do not match any user in this service'
    );
  });
});
