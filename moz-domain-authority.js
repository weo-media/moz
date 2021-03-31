const Apify = require('apify');
const Dotenv = require('dotenv');
const fs = require('fs');
if (process.env.NODE_ENV !== 'production') {
  Dotenv.config({ path: '../.env' });
}

const MozLogin = 'https://moz.com/login';
const MozAnalyze = 'https://moz.com/domain-analysis?site=';
const dateWithTime = new Date();
const date = dateWithTime.toISOString().replace(/T.*/, '');
// get urls from weo reports
const file = fs.readFileSync('./logs/' + date + '-prem-seo-urls.json');
const urls = JSON.parse(file);

Apify.main(async () => {
  // launching puppeteer
  console.log('Launching Puppeteer...');
  const browser = process.argv[2] == "withhead" ? await Apify.launchPuppeteer() : await Apify.launchPuppeteer({ headless: true });
  const page = await browser.newPage();

  console.log('logging in to moz...');
  await page.goto(MozLogin);
  await page.type('[data-fieldname="email"]', process.env.MOZUSER);
  await page.type('[data-fieldname="password"]', process.env.MOZPASS);
  await page.$eval('[data-fieldname="remember_me"]', el => el.click());
  // await page.$eval('[data-fieldname="submit"]', el => el.click());
  await page.waitForTimeout(120000);

  for await (let index of asyncIterator(urls.length)) {
    const currentUrl = urls[index];
    if (currentUrl == null) {
      console.log('encountered null');
      return;
    }
    await page.goto(MozAnalyze + currentUrl);
    await page.waitFor(1000);
    let domAuth;
    try {
      domAuth = await page.$$eval('h1', els => els[1].innerText);
    } catch (e) {
      console.log("found an err..." + e);
      domAuth = 'nothing, no data for this domain.';
    }
    let topSearch = await page.evaluate(() => {
      var arr = Array.from(document.querySelectorAll('section:nth-of-type(6) table tr')); arr = arr.map(tr => {
        let dom = tr.querySelector('td:nth-of-type(1)').innerText;
        if (
          dom.indexOf('yelp.com') !== -1 ||
          dom.indexOf('colgate.com') !== -1 ||
          dom.indexOf('webmd.com') !== -1 ||
          dom.indexOf('healthline.com') !== -1 ||
          dom.indexOf('crest.com') !== -1 ||
          dom.indexOf('wikipedia.org') !== -1 ||
          dom.indexOf('youtube.com') !== -1 ||
          dom.indexOf('groupon.com') !== -1 ||
          dom.indexOf('healthgrades.com') !== -1 ||
          dom.indexOf('quora.com') !== -1 ||
          dom.indexOf('facebook.com') !== -1 ||
          dom.indexOf('nytimes.com') !== -1 ||
          dom.indexOf('amazon.com') !== -1 ||
          dom.search(/\.edu((\s|\n)+)?$/g) !== -1 ||
          dom.search(/\.org((\s|\n)+)?$/g) !== -1 ||
          dom.search(/\.gov((\s|\n)+)?$/g) !== -1 ||
          dom.search(/\.uk((\s|\n)+)?$/g) !== -1
        ) {
          return;
        }
        let obj = {};
        obj.domain = dom;
        obj.authority = tr.querySelector('td:nth-of-type(2)').innerText;
        obj.visibility = tr.querySelector('td:nth-of-type(3)').innerText;
        return obj;
      });
      return arr;
    })
    Promise.all(domAuth, topSearch).then(() => {
      let topSearchOutput = isEmpty(topSearch, currentUrl);
      let output = `${currentUrl} has a domain authority of...
${domAuth}
and its top search competitors are...
${topSearchOutput}
`;
      console.log(output);
      fs.appendFileSync(`./logs/${date}-dom-auth.txt`, output);

      function isEmpty(ts, curUrl) {
        let txt = '';
        return ts.map(dom => {
          if (dom == null) { return }
          if (dom.domain == curUrl) { return }
          if (dom.domain === 'Domain') { return }
          return `${dom.domain} with authority of ${dom.authority}\n`;
        }).join('');
      }
    });

  }
  // for (let i = 0; i < urls.length; i++) {
  //   const url = urls[i];
  //   await page.type('[id=searchInput]', url);
  //   await page.$eval('button.btn-yellow', el => el.click());

  //   let topSearch = await page.$$eval('h3', arr => arr.filter(x => x.innerText == "Top Search Competitors")[0]);
  //   Promise.resolve(topSearch).then( val => {
  //     await page.waitFor(topSearch);
  //   })

  //   let domAuth = topSearch.parentElement.$eval('table tbody tr:nth-of-type(1) td:nth-of-type(2)', el => el.innerText);
  //   let nextComp = topSearch.parentElement.$('table tbody tr:nth-of-type(2) td:nth-of-type(1)', el => el.innerText);
  //   let nextCompDomAuth = topSearch.parentElement.$('table tbody tr:nth-of-type(2) td:nth-of-type(2)', el => el.innerText);
  //   fs.appendFileSync('./logs/' + date + '-dom-auth.txt', url + ' has a domain authority of...\n' + domAuth + '\nand its closest competitor is ' + nextComp + ' which has a domain authority of\n' + nextCompDomAuth);
  // }
  await browser.close();
});

async function* asyncIterator(cap) {
  let index = 0;
  while (index < cap) {
    yield index++;
  }
}