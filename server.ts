import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import * as cheerio from 'cheerio';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // API Proxy Route for Sports Lottery
  app.get('/api/lottery/history', async (req, res) => {
    try {
      // Method 1: Try official Sporttery API first
      const sportteryRes = await fetch('https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=50&isVerify=1&pageNo=1', {
          headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://www.lottery.gov.cn/'
          }
      });
      
      if (sportteryRes.ok) {
          const data = await sportteryRes.json();
          if (data && data.value && data.value.list && data.value.list.length > 0) {
              res.json(data);
              return;
          }
      }
    } catch (err) {
        console.warn("Sporttery API via Express failed, falling back to 500.com", err);
    }

    try {
      // Method 2: Fallback to scraping datachart.500.com (very reliable)
      const response = await fetch('https://datachart.500.com/dlt/history/newinc/history.php?limit=50', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      const text = await response.text();
      const $ = cheerio.load(text);
      const rows = $('#tdata tr').toArray().slice(0, 50).map(el => {
         const tds = $(el).find('td');
         if (tds.length === 0) return null;
         return {
           lotteryDrawNum: $(tds[0]).text().trim(),
           lotteryDrawResult: Array.from({length: 7}).map((_, i) => $(tds[i+1]).text().trim()).join(' '),
           poolBalanceAfterdraw: $(tds[8]).text().trim().replace(/,/g, ''),
           lotteryDrawTime: $(tds[14]).text().trim()
         }
      }).filter(Boolean);
      
      if (rows.length > 0) {
        res.json({ value: { list: rows } });
        return;
      }
    } catch (error) {
      console.warn("Failed to fetch from 500.com datachart", error);
    }

    // Return empty array so client can try JSONP and CORS proxies next
    res.json({ value: { list: [] } });
  });

  app.get('/api/lottery/prizeInfo', async (req, res) => {
    const drawNum = req.query.drawNum as string;
    if (!drawNum) return res.status(400).json({ error: 'Missing drawNum' });

    try {
      const response = await fetch(`https://kaijiang.500.com/shtml/dlt/${drawNum}.shtml`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://kaijiang.500.com/'
        }
      });
      if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch' });
      
      const text = await response.text();
      const $ = cheerio.load(text);
      
      let poolAmount = '';
      const spans = $('span.cfont1, span.cfont2').toArray();
      // Usually "奖池滚存" is around those spans, or we can just find any text matching "奖池.*元" or "奖池.*亿"
      const bodyText = $('body').text().replace(/\s+/g, '');
      const poolMatch = bodyText.match(/奖池滚存[:：]?([0-9.,]+)(元|亿)/);
      if (poolMatch) {
         if (poolMatch[2] === '亿') {
            poolAmount = (parseFloat(poolMatch[1]) * 100000000).toString();
         } else {
            poolAmount = poolMatch[1].replace(/,/g, '');
         }
      } else {
         // Try from table
         const trs = $('table').find('tr').toArray();
         trs.forEach(r => {
           const trText = $(r).text().replace(/\s+/g, '');
           const pMatch = trText.match(/奖池滚存.*?([0-9.,]+)(元|亿)/);
           if (pMatch) {
             if (pMatch[2] === '亿') {
                poolAmount = (parseFloat(pMatch[1]) * 100000000).toString();
             } else {
                poolAmount = pMatch[1].replace(/,/g, '');
             }
           }
         });
      }

      res.json({ drawNum, poolBalanceAfterdraw: poolAmount });
    } catch (err: any) {
      console.warn(`Failed to fetch prize info for ${drawNum}`, err);
      res.status(500).json({ error: err.message });
    }
  });

// ... (removed) ...

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
