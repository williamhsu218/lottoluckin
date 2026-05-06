import * as cheerio from 'cheerio';
fetch('https://kaijiang.500.com/shtml/dlt/26046.shtml', {
  headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
}).then(r=>r.text()).then(t=>{
  const $ = cheerio.load(t);
  const rows = $('table.kj_table tr').toArray();
  if (rows.length === 0) {
     console.log('No table.kj_table found. Trying to print all tables');
     console.log($('table').first().html());
     const scriptTags = $('script').toArray().map(s => $(s).html()?.substring(0, 50));
     console.log(scriptTags);
  }
  rows.forEach(r => {
    const tds = $(r).find('td');
    console.log(tds.map((i, el) => $(el).text().trim()).get().join(' | '));
  });
}).catch(console.error);
