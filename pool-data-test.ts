import * as cheerio from 'cheerio';
fetch('https://datachart.500.com/dlt/history/newinc/history.php?limit=10')
  .then(r=>r.text())
  .then(t=>{
    const $ = cheerio.load(t);
    const rows = $('tbody#tdata tr').toArray();
    rows.forEach(r => {
      const tds = $(r).find('td').toArray().map(td => $(td).text().trim());
      console.log(tds);
    });
  }).catch(console.error);
