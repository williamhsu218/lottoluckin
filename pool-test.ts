import * as cheerio from 'cheerio';
fetch('https://kaijiang.500.com/shtml/dlt/26046.shtml', {
  headers:{'User-Agent':'Mozilla/5.0'}
}).then(r=>r.text()).then(t=>{
  const $ = cheerio.load(t);
  const rows = $('tr').toArray();
  rows.forEach(r => {
    const text = $(r).text();
    if(text.includes('奖池滚存') || text.includes('分')) {
        console.log(text.trim());
    }
  });
  console.log('---');
  const pool = $('span').filter((i, el) => $(el).text().includes('奖池')).text();
  console.log(pool);
  
  const allSpans = $('span.cfont1, span.cfont2').toArray().map(s => $(s).text());
  console.log('Spans:', allSpans);
}).catch(console.error);
