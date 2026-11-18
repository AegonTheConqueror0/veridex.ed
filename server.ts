import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  FORENSIC_MODEL,
  runGeminiForensicsWithRetry,
  type AnalyzeRequestBody,
} from './api/analyze';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'veridex-forensic-api' });
  });

  app.post('/api/analyze', async (req: Request, res: Response) => {
    const body = req.body as AnalyzeRequestBody;
    if (!body?.imageBase64 || typeof body.imageBase64 !== 'string') {
      res.status(400).json({ error: 'Missing imageBase64 payload.' });
      return;
    }
    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in the server environment. Set it in Settings > Secrets.',
      });
      return;
    }

    try {
      const rawJson = await runGeminiForensicsWithRetry(body);
      const parsed = JSON.parse(rawJson) as Record<string, unknown>;
      res.json({
        ...parsed,
        modelUsed: FORENSIC_MODEL,
        analyzedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Forensic analysis request failed';
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: number }).status) || 500
          : 500;
      res.status(status).json({ error: message });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VERIDEX server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VERIDEX server:', err);
  process.exit(1);
});
