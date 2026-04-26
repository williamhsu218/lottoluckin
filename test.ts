import * as cheerio from 'cheerio';
fetch('https://datachart.500.com/dlt/history/newinc/history.php?limit=50', {headers: {'User-Agent': 'Mozilla/5.0'}})
  .then(r=>r.text())
  .then(t=>{
     const $ = cheerio.load(t);
     const rows = $('#tdata tr').toArray().slice(0, 50).map(el => {
        const tds = $(el).find('td');
        if (tds.length === 0) return null;
        return {
          lotteryDrawNum: $(tds[0]).text().trim(),
          lotteryDrawResult: Array.from({length: 7}).map((_, i) => $(tds[i+1]).text().trim()).join(' '),
          lotteryDrawTime: $(tds[14]).text().trim()
        }
     }).filter(Boolean);
     console.log(rows);
  });
