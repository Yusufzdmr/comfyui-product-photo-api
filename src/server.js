import express from 'express';
import { randomUUID } from 'node:crypto';
import { ComfyUIClient } from './comfyClient.js';
import { buildProductPhotoWorkflow } from './workflows/productPhoto.js';
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * HTTP servisi: e-ticaret backend'inin (Laravel/Node) cagirabilecegi REST API.
 *
 * POST /api/process
 *   - multipart/form-data: image (dosya), bg (opsiyonel hex), upscale (opsiyonel "0")
 *   - islenmis gorseli dogrudan binary olarak doner (image/png)
 *
 * GET /health  -> ComfyUI baglanti durumu
 *
 * Boylece musteri tarafi, ComfyUI'in ic detaylarini bilmeden tek bir
 * endpoint cagirarak "studyo kalitesinde urun gorseli" alir.
 */
const app = express();

const client = new ComfyUIClient({
  baseUrl: config.comfy.baseUrl,
  wsUrl: config.comfy.wsUrl,
  timeoutMs: config.pipeline.jobTimeoutMs,
});

app.get('/health', async (_req, res) => {
  try {
    const stats = await client.ping();
    res.json({ status: 'ok', comfyui: stats.system?.comfyui_version || 'baglandi' });
  } catch (err) {
    res.status(503).json({ status: 'down', error: err.message });
  }
});

// Ham dosya yukleme: image/* govdesini buffer olarak al
app.post(
  '/api/process',
  express.raw({ type: ['image/*', 'application/octet-stream'], limit: '25mb' }),
  async (req, res) => {
    if (!req.body || !req.body.length) {
      return res.status(400).json({ error: 'Gorsel govdesi bos. image/* gonderin.' });
    }

    const bgColor = req.query.bg || config.pipeline.studioBgColor;
    const upscale = req.query.upscale !== '0';
    const jobId = randomUUID().slice(0, 8);
    const inputName = `api_${jobId}.png`;

    try {
      logger.info(`[${jobId}] istek alindi (bg=${bgColor}, upscale=${upscale})`);

      const uploaded = await client.uploadImage(req.body, inputName);
      const workflow = buildProductPhotoWorkflow({
        imageName: uploaded.name,
        upscaleModel: config.pipeline.upscaleModel,
        bgColor,
        upscale,
        filenamePrefix: `api_${jobId}`,
      });

      const images = await client.runWorkflow(workflow);
      if (!images.length) throw new Error('Cikti uretilmedi');

      const result = await client.fetchImage(images[0]);
      logger.success(`[${jobId}] tamamlandi (${(result.length / 1024).toFixed(0)} KB)`);

      res.set('Content-Type', 'image/png');
      res.set('X-Job-Id', jobId);
      res.send(result);
    } catch (err) {
      logger.error(`[${jobId}] hata: ${err.message}`);
      res.status(500).json({ error: err.message, jobId });
    }
  },
);

app.listen(config.server.port, () => {
  logger.success(`HTTP servis hazir: http://localhost:${config.server.port}`);
  logger.info(`ComfyUI hedefi: ${config.comfy.baseUrl}`);
});
