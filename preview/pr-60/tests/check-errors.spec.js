const { test, expect } = require('@playwright/test');

test('no JavaScript errors on main page', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(8000);
  expect(errors, `JavaScript errors:\n${errors.join('\n')}`).toEqual([]);
});
