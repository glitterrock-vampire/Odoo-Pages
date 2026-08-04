import { test, expect } from '@playwright/test';

test.describe('CDT Demo Links', () => {
  test('Admin dashboard loads', async ({ page }) => {
    await page.goto('https://cdt-admin-dashboard.loca.lt/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if page loaded successfully
    expect(page.url()).toContain('cdt-admin-dashboard');
    
    // Take screenshot for verification
    await page.screenshot({ path: 'admin-dashboard.png' });
  });

  test('Parent portal loads', async ({ page }) => {
    await page.goto('https://cdt-odoo-portal.loca.lt/web/login?db=cdt_jamaica&redirect=/my/education');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if we're on the Odoo login page
    expect(page.url()).toContain('cdt-odoo-portal');
    
    // Take screenshot for verification
    await page.screenshot({ path: 'parent-portal.png' });
  });

  test('Admin dashboard is accessible', async ({ request }) => {
    const response = await request.get('https://cdt-admin-dashboard.loca.lt/');
    expect(response.status()).toBe(200);
  });

  test('Parent portal is accessible', async ({ request }) => {
    const response = await request.get('https://cdt-odoo-portal.loca.lt/web/login?db=cdt_jamaica&redirect=/my/education');
    expect(response.status()).toBe(200);
  });
});
