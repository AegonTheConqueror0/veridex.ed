import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AnalyzeRequestBody } from '../lib/forensics';

type VercelRequest = IncomingMessage & { body?: unknown; method?: string };

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function parseBody(body: unknown): AnalyzeRequestBody | null {
  if (body == null) return null;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as AnalyzeRequestBody;
    } catch {
      return null;
    }
  }
  if (typeof body === 'object') return body as AnalyzeRequestBody;
  return null;
}

export default async function handler(
  req: VercelRequest,
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
    return;
  }

  const body = parseBody(req.body);
  if (!body?.imageBase64 || typeof body.imageBase64 !== 'string') {
    sendJson(res, 400, { error: 'Missing imageBase64 payload.' });
    return;
  }
  if (!process.env.GEMINI_API_KEY) {
    sendJson(res, 503, {
      error:
        'GEMINI_API_KEY is not configured in the server environment. Add it to your Vercel Project Settings > Environment Variables.',
    });
    return;
  }

  try {
    // Imported lazily so any load/runtime failure is caught and returned as
    // JSON instead of crashing the function with an opaque empty 500.
    const { FORENSIC_MODEL, runGeminiForensicsWithRetry } = await import(
      '../lib/forensics'
    );
    const rawJson = await runGeminiForensicsWithRetry(body);
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    sendJson(res, 200, {
      ...parsed,
      modelUsed: FORENSIC_MODEL,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error('[veridex] /api/analyze failed:', err);
    const message =
      err instanceof Error ? err.message : 'Forensic analysis request failed';
    const status =
      typeof err === 'object' && err !== null && 'status' in err
        ? Number((err as { status?: number }).status) || 500
        : 500;
    sendJson(res, status, { error: message });
  }
}
