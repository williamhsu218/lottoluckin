import 'dotenv/config';
import express from 'express';
import path from 'path';
import { generateAiDraws } from './src/server/ai-service';
import lotteryData from './src/server/lottery-data.cjs';

const { fetchLotteryHistory, fetchPrizeInfo } = lotteryData as {
  fetchLotteryHistory: () => Promise<unknown>;
  fetchPrizeInfo: (drawNum: string) => Promise<unknown>;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // API Proxy Route for Sports Lottery
  app.get('/api/lottery/history', async (req, res) => {
    try {
      res.json(await fetchLotteryHistory());
    } catch (error: any) {
      console.warn("Failed to fetch lottery history", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/lottery/prizeInfo', async (req, res) => {
    const drawNum = req.query.drawNum as string;
    if (!drawNum) return res.status(400).json({ error: 'Missing drawNum' });

    try {
      res.json(await fetchPrizeInfo(drawNum));
    } catch (err: any) {
      console.warn(`Failed to fetch prize info for ${drawNum}`, err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/ai/generate', async (req, res) => {
    try {
      const { mode, pkg, results } = req.body || {};
      if ((mode !== 'stats' && mode !== 'iching') || !pkg || !Array.isArray(results)) {
        return res.status(400).json({ error: 'Invalid generation request' });
      }

      const draws = await generateAiDraws({ mode, pkg, results });
      res.json({ draws });
    } catch (err: any) {
      const status = err.message === 'Server AI key is not configured' ? 503 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
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
