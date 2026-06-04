import http from 'node:http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { generateStudioOutput } from './assets.js';

/**
 * MOCK COMFYUI SUNUCUSU
 * ---------------------
 * ComfyUI'in API yuzeyini (yeterli kismini) taklit eder; boylece pipeline
 * kodu GERCEKTEN ucdan uca calistirilabilir -- GPU, model veya ComfyUI
 * kurulumu olmadan. Amac: orchestration mantiginin (upload -> prompt ->
 * WebSocket olaylari -> view) dogru calistigini kanitlamak.
 *
 * Taklit edilen uclar:
 *   GET  /system_stats     -> saglik
 *   POST /upload/image     -> dosyayi kabul eder (icerigi onemsemez)
 *   POST /prompt           -> isi kuyruga alir, prompt_id doner
 *   WS   /ws               -> progress/executed/executing olaylarini yayinlar
 *   GET  /view             -> uretilmis "studyo" gorselini doner
 */
export function startMockServer(port = 8199) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // clientId -> bekleyen is (prompt_id)
  const pending = new Map();
  let counter = 0;

  app.get('/system_stats', (_req, res) => {
    res.json({ system: { comfyui_version: 'mock-1.0', os: 'demo' } });
  });

  app.post('/upload/image', (req, res) => {
    req.resume(); // govdeyi tuket (mock icerigi kullanmaz)
    res.json({ name: 'demo-product.png', subfolder: '', type: 'input' });
  });

  app.post('/prompt', (req, res) => {
    const clientId = req.body.client_id;
    counter += 1;
    const promptId = `mock-${counter}`;
    pending.set(clientId, promptId);
    res.json({ prompt_id: promptId, number: counter, node_errors: {} });
  });

  app.get('/view', (_req, res) => {
    res.set('Content-Type', 'image/png');
    res.send(generateStudioOutput());
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const clientId = url.searchParams.get('clientId');
    const promptId = pending.get(clientId);
    if (!promptId) return;
    pending.delete(clientId);

    const send = (type, data) => ws.send(JSON.stringify({ type, data: { ...data, prompt_id: promptId } }));

    // Gercekci bir akis: birkac ilerleme adimi, sonra cikti, sonra tamamlandi
    const steps = 8;
    let step = 0;
    const tick = setInterval(() => {
      step += 1;
      send('progress', { value: step, max: steps, node: '5' });
      if (step >= steps) {
        clearInterval(tick);
        send('executed', {
          node: '8',
          output: { images: [{ filename: 'demo-product_studio_00001_.png', subfolder: '', type: 'output' }] },
        });
        send('executing', { node: null });
      }
    }, 120);

    ws.on('close', () => clearInterval(tick));
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        wsUrl: `ws://127.0.0.1:${port}/ws`,
        close: () => new Promise((r) => { wss.close(); server.close(r); }),
      });
    });
  });
}

export default startMockServer;
