import { test, expect } from '@playwright/test';

test.describe('Login correto', () => {
  test('Login correto', async ({ page }) => {
    // Step 1 - Acessar a URL da tela
    await page.goto('https://www.saucedemo.com/');

    // Step 2 - Preencher o campo "Username" com o login
    await page.locator('#user-name').fill('standard_user');

    // Step 3 - Preencher o campo "Password" com a senha
    await page.locator('#password').fill('secret_sauce');

    // Step 4 - Clicar no botão "Login"
    await page.locator('#login-button').click();

    // Step 5 - Validar que a tela "Products" foi exibida
    await expect(page.locator('[data-test="title"]')).toBeVisible();
  });
});
