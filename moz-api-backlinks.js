const Dotenv = require('dotenv');
const fs = require('fs');
require('isomorphic-fetch');
const async = require('async');
if (process.env.NODE_ENV !== 'production') {
  Dotenv.config({ path: '../.env' });
}

const getBacklinks = async (urlOrUrls) => {
  const bodyData = {
    targets: Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls]
  }
  const backlinks = await fetch(`${process.env.MOZBASE}url_metrics`, {
    method: 'POST',
    headers: new Headers({
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${process.env.MOZACCESSID}:${process.env.MOZSECRET}`).toString('base64')}`,
    }),
    body: JSON.stringify(bodyData)
  })
    .then(r => {
      return r.json()
    })
    .then(r => {
      // console.log(r);
      return r.results[0]['external_pages_to_root_domain']
      // return r.results[0]
    })
    .catch(err => { if (err) throw err });

  // console.log(backlinks);

  return backlinks
}
// console.log(process.argv[2]);
// getBacklinks(process.argv[2]).then(r => console.log(r));
// let urlsIndex = 0;
const dateWithTime = new Date();
const date = dateWithTime.toISOString().replace(/T.*/, '');
// get urls from weo reports
const file = fs.readFileSync('./logs/' + date + '-prem-seo-urls.json');
const urls = JSON.parse(file);
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

fs.writeFileSync(`./logs/${date}-backlinks.txt`, '');

async.eachLimit(urls, 1, async (url) => {
  console.log(url);
  let output = `${url} has ${await getBacklinks(url)} unique external pages currently linking to this root domain. Pages that link to themselves do not contribute to this count.


`;
  console.log(output);
  fs.appendFileSync(`./logs/${date}-backlinks.txt`, output);
  await sleep(11000);
})