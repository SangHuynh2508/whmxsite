const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  
  try {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.char-item', { timeout: 5000 });
    await page.click('.char-item');
    await new Promise(r => setTimeout(r, 800));
    
    const info = await page.evaluate(() => {
      const art = document.querySelector('.character-artwork');
      const base = document.querySelector('.ticket-base');
      const frameCheck = document.querySelector('.character-card-stage');

      const artRect = art ? art.getBoundingClientRect() : null;
      const baseRect = base ? base.getBoundingClientRect() : null;

      return {
        ticketBaseSrc: base ? base.src : null,
        artSrc: art ? art.src : null,
        artWidth: artRect ? artRect.width : 0,
        artHeight: artRect ? artRect.height : 0,
        baseWidth: baseRect ? baseRect.width : 0,
        baseHeight: baseRect ? baseRect.height : 0,
        oldStageRemoved: frameCheck === null
      };
    });
    
    await page.screenshot({ path: 'tools/test_clean_card.png' });
    console.log('SIMPLIFIED CLEAN TICKET CARD VERIFICATION:', JSON.stringify(info, null, 2));
  } catch(e) {
    console.error('TEST ERROR:', e);
  } finally {
    await browser.close();
  }
})();
