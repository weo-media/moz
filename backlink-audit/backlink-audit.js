// Log into Moz.com
// Enter the client's URL into the Link Explorer
// Record the number of Inbound Links
// Search for the money phrase with the location in an incognito window
// Repeat the Link Explorer search for the top two competitors in the Local Block
// Record the number of Inbound Links for both

const dotenv = require('dotenv');
const puppeteer = require('puppeteer');
const async = require('async');
const fs = require('fs');
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '../.env' });
}

const MozLogin = 'https://moz.com/login';
const MozAnalyze = 'https://analytics.moz.com/pro/link-explorer/overview?site='
const dateWithTime = new Date();
const date = dateWithTime.toISOString().replace(/T.*/, '');
// get urls from weo reports
const file = fs.readFileSync('./logs/' + date + '-prem-seo-urls.json');
const urls = JSON.parse(file);
const clientInfoFile = fs.readFileSync('./logs/' + date + '-client-info.json');
const clientInfo = JSON.parse(clientInfoFile);
fs.writeFileSync('./logs/' + date + '-backlink-audit.txt', '');

(async () => {
  const browser = process.argv[2] == "withhead" ? await puppeteer.launch({ headless: false }) : await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  console.log('logging in to moz...');
  await page.goto(MozLogin);
  await page.type('[data-fieldname="email"]', process.env.MOZUSER);
  await page.type('[data-fieldname="password"]', process.env.MOZPASS);
  await page.$eval('[data-fieldname="remember_me"]', el => el.click());
  await page.$eval('[data-fieldname="submit"]', el => el.click());
  await page.waitForNavigation();

  for await (let index of asyncIterator(urls.length)) {
    const currentUrl = urls[index];
    console.log('\n\n' + currentUrl);
    if (currentUrl == null) {
      console.log('encountered null');
      return;
    }
    async function getInboundLinks(analyzeUrl) {
      if (analyzeUrl === '') { return null }
      await page.goto(MozAnalyze + analyzeUrl);
      await page.waitForSelector('.metric-label + *');
      // await page.waitForTimeout(3000);
      // [...document.querySelectorAll('.metric-label>span')].find(x => x.innerText === 'Inbound Links').parentElement.nextSibling.innerText
      const inboundLinks = await page.$$eval('.metric-label>span', elems => elems.find(el => el.innerText === 'Inbound Links').parentElement.nextSibling.innerText);

      return await inboundLinks;
    }
    const inboundLinks = await getInboundLinks(currentUrl);

    const brLocClient = clientInfo.some(client => {
      const brLocUrls = client.url.map(url => url.replace(/https?:\/\//, ''));
      return brLocUrls.some(url => url === currentUrl + '/');
    })
      ? clientInfo.filter(client => {
        const brLocUrls = client.url.map(url => url.replace(/https?:\/\//, ''));
        return brLocUrls.some(url => url === currentUrl + '/');
      }).map(accounts => ({ name: accounts.name, primeKey: accounts.primeKeyword }))
      : null;

    console.log('inboundLinks: ', await inboundLinks, '\nurl found: ', JSON.stringify(clientInfo).match(currentUrl) ? true : false, '\nbrightlocal client: ', brLocClient);

    if (brLocClient === null || brLocClient.length <= 0) {
      // append to file
      fs.appendFile('./logs/' + date + '-backlink-audit.txt', `\n${currentUrl}\nInbound Links: ${inboundLinks}\nCould not find in BrightLocal\n\n`, err => { if (err) throw err; 'appended to backlink audit file' });
    } else if (brLocClient.length === 1) {
      const blClient = brLocClient[0];
      // Create a new incognito browser context
      const incognitoContext = await browser.createIncognitoBrowserContext();
      // Create a new page inside incognitoContext.
      const page2 = await incognitoContext.newPage();
      // ... do stuff with page ...
      // if there is a primary keyphrase then search google.
      blClient.primeKey ? await page2.goto('https://www.google.com/search?q=' + blClient.primeKey) : console.log('no keyword');
      // get competitors
      const firstTenResults = await page2.$$eval('.g > div > div > a > div > cite', elems => elems.map(elem => elem.innerText.replace(/(\s.+)/, '')));
      console.log(firstTenResults);

      // Dispose incognitoContext once it's no longer needed.
      // await page2.waitForTimeout(100000);
      await incognitoContext.close();

      // get inboundLinks for competitors
      const competitorInboundLinks = await async.mapSeries(firstTenResults, async (competitor) => {
        const competitorLinks = await getInboundLinks(competitor);
        return [competitor, competitorLinks];
      });

      // append to file
      fs.appendFile('./logs/' + date + '-backlink-audit.txt', `\n${blClient.name}\n${currentUrl}\nInbound Links: ${inboundLinks}\nPrimary Keyword from BrightLocal: ${blClient.primeKey}\nCompetitor Inbound Links: \n${JSON.stringify(await competitorInboundLinks)}\n\n`, err => { if (err) throw err; 'appended to backlink audit file' });
    } else if (brLocClient.length >= 2) {
      // if more than two locations then do for each location 
      await async.eachOfSeries(brLocClient, async (blClient, iter) => {
        // Create a new incognito browser context
        const incognitoContext = await browser.createIncognitoBrowserContext();
        // Create a new page inside incognitoContext.
        const page2 = await incognitoContext.newPage();
        // ... do stuff with page ...
        // if there is a primary keyphrase then search google.
        blClient.primeKey ? await page2.goto('https://www.google.com/search?q=' + blClient.primeKey) : console.log('no keyword');
        // get competitors
        const firstTenResults = await page2.$$eval('.g > div > div > a > div > cite', elems => elems.map(elem => elem.innerText.replace(/(\s.+)/, '')));
        console.log(firstTenResults);

        // Dispose incognitoContext once it's no longer needed.
        // await page2.waitForTimeout(100000);
        await incognitoContext.close();

        // get inboundLinks for competitors
        const competitorInboundLinks = await async.mapSeries(firstTenResults, async (competitor) => {
          const competitorLinks = await getInboundLinks(competitor);
          return [competitor, competitorLinks];
        });

        // await page.waitForTimeout(1000000);

        // append to text file
        fs.appendFile('./logs/' + date + '-backlink-audit.txt', `\n${blClient.name}\n${currentUrl} ${iter + 1}\nInbound Links: ${inboundLinks}\nPrimary Keyword from BrightLocal: ${blClient.primeKey}\nCompetitor Inbound Links: \n${JSON.stringify(await competitorInboundLinks)}\n\n`, err => { if (err) throw err; 'appended to backlink audit file' });
      });
    }
  }
  await browser.close();

})();

async function* asyncIterator(cap) {
  let index = 0;
  while (index < cap) {
    yield index++;
  }
}