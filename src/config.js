import 'dotenv/config';

/**
 * Ortam degiskenlerinden uygulama yapilandirmasini olusturur.
 * Tek noktadan yonetilir; her modul buradan okur.
 */
const host = process.env.COMFYUI_HOST || '127.0.0.1';
const port = process.env.COMFYUI_PORT || '8188';
const secure = String(process.env.COMFYUI_SECURE).toLowerCase() === 'true';

const httpProto = secure ? 'https' : 'http';
const wsProto = secure ? 'wss' : 'ws';

export const config = {
  comfy: {
    host,
    port,
    secure,
    baseUrl: `${httpProto}://${host}:${port}`,
    wsUrl: `${wsProto}://${host}:${port}/ws`,
  },
  paths: {
    inputDir: process.env.INPUT_DIR || './input',
    outputDir: process.env.OUTPUT_DIR || './output',
  },
  pipeline: {
    upscaleModel: process.env.UPSCALE_MODEL || '4x-UltraSharp.pth',
    studioBgColor: process.env.STUDIO_BG_COLOR || 'FFFFFF',
    jobTimeoutMs: Number(process.env.JOB_TIMEOUT_MS || 180000),
  },
  server: {
    port: Number(process.env.SERVER_PORT || 3000),
  },
};

export default config;
