import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should display login page for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    
    await expect(page).toHaveURL(/.*login.*/);
  });
});
