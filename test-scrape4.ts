import * as cheerio from 'cheerio';
fetch('https://kaijiang.500.com/shtml/dlt/26046.shtml', {
  headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
}).then(r=>r.text()).then(t=>{
  const $ = cheerio.load(t);
  const rows = $('tr').toArray();
  rows.forEach(r => {
    const tds = $(r).find('td');
    const textArr = tds.map((i, el) => $(el).text().trim()).get();
    if (textArr.join(',').includes('奖金')) {
        console.log(textArr.join(' | '));
    }
    if (textArr.some(t => t.includes('等奖'))) {
        console.log(textArr.join(' | '));
    }
  });
}).catch(console.error);
