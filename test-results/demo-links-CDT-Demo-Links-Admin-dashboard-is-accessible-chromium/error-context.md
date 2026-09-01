# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demo-links.spec.ts >> CDT Demo Links >> Admin dashboard is accessible
- Location: demo-links.spec.ts:30:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 503
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('CDT Demo Links', () => {
  4  |   test('Admin dashboard loads', async ({ page }) => {
  5  |     await page.goto('https://cdt-admin-dashboard.loca.lt/');
  6  |     
  7  |     // Wait for page to load
  8  |     await page.waitForLoadState('networkidle');
  9  |     
  10 |     // Check if page loaded successfully
  11 |     expect(page.url()).toContain('cdt-admin-dashboard');
  12 |     
  13 |     // Take screenshot for verification
  14 |     await page.screenshot({ path: 'admin-dashboard.png' });
  15 |   });
  16 | 
  17 |   test('Parent portal loads', async ({ page }) => {
  18 |     await page.goto('https://cdt-odoo-portal.loca.lt/web/login?db=cdt_jamaica&redirect=/my/education');
  19 |     
  20 |     // Wait for page to load
  21 |     await page.waitForLoadState('networkidle');
  22 |     
  23 |     // Check if we're on the Odoo login page
  24 |     expect(page.url()).toContain('cdt-odoo-portal');
  25 |     
  26 |     // Take screenshot for verification
  27 |     await page.screenshot({ path: 'parent-portal.png' });
  28 |   });
  29 | 
  30 |   test('Admin dashboard is accessible', async ({ request }) => {
  31 |     const response = await request.get('https://cdt-admin-dashboard.loca.lt/');
> 32 |     expect(response.status()).toBe(200);
     |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  33 |   });
  34 | 
  35 |   test('Parent portal is accessible', async ({ request }) => {
  36 |     const response = await request.get('https://cdt-odoo-portal.loca.lt/web/login?db=cdt_jamaica&redirect=/my/education');
  37 |     expect(response.status()).toBe(200);
  38 |   });
  39 | });
  40 | 
```