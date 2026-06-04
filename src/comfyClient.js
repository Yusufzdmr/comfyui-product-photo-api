import WebSocket from 'ws';
import { Blob } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { logger } from './logger.js';

/**
 * ComfyUI HTTP + WebSocket API istemcisi.
 *
 * ComfyUI ic mimarisi su sekilde calisir:
 *   1. POST /prompt   -> "API formatindaki" workflow graph'i kuyruga atar, prompt_id doner.
 *   2. WS /ws         -> ayni client_id ile baglanip "executing", "progress",
 *                        "executed", "execution_error" olaylarini canli dinleriz.
 *   3. GET /view      -> uretilen gorseli (filename/subfolder/type) indiririz.
 *   4. POST /upload   -> input gorseli sunucuya yukleriz (LoadImage node'u icin).
 *
 * Bu istemci tum bu akisi tek bir Promise'e sarar: runWorkflow() cagrildiginda
 * is bitene kadar bekler, ilerlemeyi raporlar ve sonuc gorselleri buffer olarak doner.
 */
export class ComfyUIClient {
  /**
   * @param {object} opts
   * @param {string} opts.baseUrl  ornek: http://127.0.0.1:8188
   * @param {string} opts.wsUrl    ornek: ws://127.0.0.1:8188/ws
   * @param {number} [opts.timeoutMs]
   */
  constructor({ baseUrl, wsUrl, timeoutMs = 180000 }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.wsUrl = wsUrl;
    this.timeoutMs = timeoutMs;
    this.clientId = randomUUID();
  }

  /** Sunucunun ayakta olup olmadigini kontrol eder. */
  async ping() {
    const res = await fetch(`${this.baseUrl}/system_stats`);
    if (!res.ok) throw new Error(`ComfyUI erisilemez (HTTP ${res.status})`);
    return res.json();
  }

  /**
   * Yerel bir gorsel buffer'ini ComfyUI input klasorune yukler.
   * @param {Buffer} buffer
   * @param {string} filename
   * @returns {Promise<{name:string, subfolder:string, type:string}>}
   */
  async uploadImage(buffer, filename) {
    const form = new FormData();
    form.append('image', new Blob([buffer]), filename);
    form.append('overwrite', 'true');

    const res = await fetch(`${this.baseUrl}/upload/image`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      throw new Error(`Gorsel yuklenemedi (HTTP ${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    logger.step(`Gorsel yuklendi -> ${data.name}`);
    return data;
  }

  /**
   * Workflow graph'i kuyruga ekler.
   * @param {object} workflow  API formatinda graph (node_id -> {class_type, inputs})
   * @returns {Promise<string>} prompt_id
   */
  async queuePrompt(workflow) {
    const res = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: this.clientId }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      const detail = data.node_errors
        ? JSON.stringify(data.node_errors)
        : JSON.stringify(data.error || data);
      throw new Error(`Workflow reddedildi: ${detail}`);
    }
    return data.prompt_id;
  }

  /** Belirli bir prompt_id icin gecmis/cikti kayitlarini getirir. */
  async getHistory(promptId) {
    const res = await fetch(`${this.baseUrl}/history/${promptId}`);
    if (!res.ok) throw new Error(`Gecmis alinamadi (HTTP ${res.status})`);
    return res.json();
  }

  /** Uretilmis bir gorseli ham byte olarak indirir. */
  async fetchImage({ filename, subfolder = '', type = 'output' }) {
    const qs = new URLSearchParams({ filename, subfolder, type });
    const res = await fetch(`${this.baseUrl}/view?${qs.toString()}`);
    if (!res.ok) throw new Error(`Gorsel indirilemedi: ${filename}`);
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * Bir workflow'u calistirir ve TAMAMLANANA kadar bekler.
   * WebSocket uzerinden canli ilerleme raporlar.
   *
   * @param {object} workflow API formatinda graph
   * @param {(p:{node:string,value:number,max:number})=>void} [onProgress]
   * @returns {Promise<Array<{filename:string,subfolder:string,type:string}>>}
   *          uretilen gorsellerin referanslari
   */
  async runWorkflow(workflow, onProgress) {
    const promptId = await this.queuePrompt(workflow);
    logger.step(`Is kuyruga alindi (prompt_id: ${promptId})`);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.wsUrl}?clientId=${this.clientId}`);
      const collected = [];

      const timer = setTimeout(() => {
        ws.close();
        reject(new Error(`Is zaman asimina ugradi (${this.timeoutMs} ms)`));
      }, this.timeoutMs);

      const finish = (fn, arg) => {
        clearTimeout(timer);
        try { ws.close(); } catch { /* yoksay */ }
        fn(arg);
      };

      ws.on('open', () => logger.step('WebSocket baglandi, olaylar dinleniyor'));

      ws.on('message', (raw, isBinary) => {
        if (isBinary) return; // onizleme gorselleri (binary) bu demoda kullanilmiyor
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        const { type, data } = msg;
        if (!data || data.prompt_id !== promptId) {
          // status gibi global mesajlarda prompt_id olmayabilir; sadece bizim isi filtrele
          if (type !== 'progress' && type !== 'executing') return;
        }

        switch (type) {
          case 'progress':
            onProgress?.({ node: data.node, value: data.value, max: data.max });
            break;

          case 'executed':
            if (data.output?.images?.length) {
              collected.push(...data.output.images);
            }
            break;

          case 'execution_error':
            finish(reject, new Error(
              `ComfyUI calisma hatasi: ${data.exception_message || 'bilinmiyor'}`,
            ));
            break;

          case 'executing':
            // node === null => bu prompt icin yurutme tamamlandi
            if (data.node === null && data.prompt_id === promptId) {
              finish(resolve, collected);
            }
            break;

          default:
            break;
        }
      });

      ws.on('error', (err) => finish(reject, err));
      ws.on('close', () => clearTimeout(timer));
    });
  }
}

export default ComfyUIClient;
