import * as cheerio from 'cheerio';
fetch('https://datachart.500.com/dlt/history/newinc/history.php?limit=10', {
  headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
}).then(r=>r.text()).then(t=>{
  const $ = cheerio.load(t);
  const rows = $('#tdata tr').toArray();
  rows.forEach(r => {
    const tds = $(r).find('td').toArray().map(td => $(td).text().trim());
    console.log(tds);
    // index 8 is 奖池奖金
  });
}).catch(console.error);
