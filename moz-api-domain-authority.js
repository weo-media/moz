const Dotenv = require('dotenv');
const fs = require('fs');
require('isomorphic-fetch');
const async = require('async');
if (process.env.NODE_ENV !== 'production') {
  Dotenv.config({ path: '../.env' });
}

const getDomainAuthority = async (urlOrUrls) => {
  const bodyData = {
    targets: Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls]
    // target: urlOrUrls
  }
  //top_pages
  //url_metrics
  //linking_root_domains
  const domainAuthority = await fetch(`${process.env.MOZBASE}url_metrics`, {
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
      return r.results[0]['domain_authority']
    })
    .catch(err => { if (err) throw err });

  // console.log(domainAuthority);

  return domainAuthority
}
// console.log(process.argv[2]);
// getDomainAuthority(process.argv[2]);
let urlsIndex = 0;
const dateWithTime = new Date();
const date = dateWithTime.toISOString().replace(/T.*/, '');
// get urls from weo reports
const file = fs.readFileSync('./logs/' + date + '-prem-seo-urls.json');
const urls = JSON.parse(file);
fs.writeFileSync(`./logs/${date}-dom-auth.txt`, '');
do {
  setInterval(async () => {
    // console.log(urls[urlsIndex]);
    let output = `${urls[urlsIndex]} has a Domain Authority of ${await getDomainAuthority(urls[urlsIndex])}.
The Domain Authority is a Moz Links API score from 1 to 100 representing the likelihood that the source root domain will rank well in search engine result pages.

`;
    console.log(output);
    fs.appendFileSync(`./logs/${date}-dom-auth.txt`, output);
    urlsIndex++;
  }, 11000);
} while (urlsIndex < urls.length);