const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  // Kalau mau pakai Brave, ubah executablePath di bawah
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/usr/bin/brave', // lokasi Brave di Manjaro
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://daring.uin-suka.ac.id');
  console.log('➡️ Silakan login dan selesaikan CAPTCHA di jendela Brave yang terbuka.');
  console.log('➡️ Setelah berhasil masuk ke dashboard, tekan Enter di terminal ini.');

  process.stdin.once('data', async () => {
    await context.storageState({ path: 'storageState.json' });
    console.log('✅ Session disimpan ke storageState.json');
    await browser.close();
    process.exit(0);
  });
})();
