const Apify = require('apify');
const Dotenv = require('dotenv');
const fs = require('fs');
if (process.env.NODE_ENV !== 'production') {
  Dotenv.config({ path: '../.env' });
}

const WEO = 'https://www.weo2.com/sys/';
const WEOLogin = WEO + process.env.WEOLOGIN + '3';
const WEOreport3 = WEO + process.env.WEOREPORT + '3';
const WEOreport12 = WEO + process.env.WEOREPORT + '12';
const WEOLogout = WEO + process.env.WEOLOGOUT;
const WEOReset = WEO + process.env.WEORESET;

const dateWithTime = new Date();
const date = dateWithTime.toISOString().replace(/T.*/, '');


Apify.main(async () => {
  // launching puppeteer
  console.log('Launching Puppeteer...');
  const browser = process.argv[2] == "withhead" ? await Apify.launchPuppeteer() : await Apify.launchPuppeteer({ headless: true });
  const page = await browser.newPage();

  // clear cookies and session
  await page.waitForTimeout(3000);

  // get urls from weo reports
  console.log('logging in to weo...');
  await page.goto(WEO);
  await page.waitForTimeout(3000);
  await page.goto(WEOLogin);
  // await page.evaluate( () => {
  //   document.querySelector('[name="PW"]').value = process.env.WEOPASS;
  //   document.querySelector('[name="Login"]').click();
  // });
  await page.type('[name="PW"]', process.env.WEOPASS);
  await page.$eval('[name="Login"]', el => { el.click() });

  if (await page.title() === 'Logout') {
    await page.waitForTimeout(300);
    console.log('cookie before reset:', await page.cookies());
    await page.goto(WEOLogin + WEOReset);
    console.log('cookie after reset:', await page.cookies());
    await page.goto(WEOLogin);
    // await page.evaluate( () => {
    //   document.querySelector('[name="PW"]').value = process.env.WEOPASS;
    //   document.querySelector('[name="Login"]').click();
    // });
    await page.type('[name="PW"]', process.env.WEOPASS);
    await page.$eval('[name="Login"]', el => { el.click() });
  }

  // partner 3
  console.log('navigating to weo reports for partner 3...');
  await page.goto(WEOreport3);
  console.log('getting urls from partner 3...');
  await page.waitForSelector('.TPwlr td:nth-child(8)', { timeout: '15000' });
  let urlsPtnr3 = await page.$$eval('.TPwlr td:nth-child(8)', tds => {
    return tds.map(td => {
      return td.innerText;
    });
  });
  // partner 12
  console.log('navigating to weo reports for partner 12...');
  await page.goto(WEOreport12);
  console.log('getting urls from partner 12...');
  await page.waitForSelector('.TPwlr td:nth-child(8)', { timeout: '15000' });
  let urlsPtnr12 = await page.$$eval('.TPwlr td:nth-child(8)', tds =>
    tds.map(td =>
      td.innerText
    )
  );
  // combine arrays
  console.log('saving urls...');
  Promise.all([urlsPtnr3, urlsPtnr12]).then((res) => {
    let urls = [...res[0], ...res[1]];

    fs.writeFile('./logs/' + date + '-prem-seo-urls.json', JSON.stringify(urls), err => {
      if (err) {
        throw err;
      }
    });
  });
  // fs.opendir('./logs/', (err,fd) => {
  //   if (err) {
  //     if (err.code == 'ENOENT') {
  //       fs.mkdir('./logs/', { recursive: true }, () => {
  //         console.log('created logs folder...');
  //       });
  //       return;
  //     }
  //     throw err;
  //   }
  //   fs.close(fd, err => {
  //     if (err) throw err;
  //   });
  // });

  await page.goto(WEOLogin + WEOReset);
  await browser.close();
});