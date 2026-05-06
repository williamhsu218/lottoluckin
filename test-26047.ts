import * as cheerio from 'cheerio';
fetch('https://kaijiang.500.com/shtml/dlt/26047.shtml', {
  headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
}).then(r=>r.text()).then(t=>{
  const $ = cheerio.load(t);
  $('tr').toArray().forEach(r => {
    const textArr = $(r).find('td').toArray().map(el => $(el).text().trim());
    if (textArr.some(text => text.includes('等奖'))) console.log(textArr.join(' | '));
  });
});
