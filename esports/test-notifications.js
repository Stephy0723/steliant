import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.createContext();
  const page = await context.newPage();

  await page.goto('http://localhost:5174');
  await page.waitForTimeout(2000);

  // Take screenshot of initial page
  await page.screenshot({ path: 'screenshot-initial.png' });

  // Look for notification icon/button
  await page.click('button[aria-label="Notificaciones"], button:has-text("Notificaciones"), [data-testid="notifications-btn"]').catch(() => {
    console.log('No encontró botón directo, buscando en header');
  });

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshot-notifications.png' });

  console.log('Screenshots tomadas');
  await browser.close();
})();
