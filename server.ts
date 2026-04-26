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
