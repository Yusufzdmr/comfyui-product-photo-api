/**
 * METIN -> GORSEL WORKFLOW'U (API format)
 * ----------------------------------------
 * Tamamen ComfyUI cekirdek node'lariyla calisir (ekstra paket gerektirmez).
 * Toplu (batch) gorsel uretimi senaryolari icin kullanilir.
 *
 *   CheckpointLoader -> CLIP encode (positive/negative) -> EmptyLatent
 *                    -> KSampler -> VAEDecode -> SaveImage
 */

/**
 * @param {object} params
 * @param {string} params.checkpoint    models/checkpoints altindaki .safetensors
 * @param {string} params.prompt        pozitif prompt
 * @param {string} [params.negative]    negatif prompt
 * @param {number} [params.width]
 * @param {number} [params.height]
 * @param {number} [params.steps]
 * @param {number} [params.cfg]
 * @param {number} [params.seed]
 * @param {string} [params.sampler]
 * @param {string} [params.scheduler]
 * @param {number} [params.batchSize]
 * @param {string} [params.filenamePrefix]
 * @returns {object} API formatinda workflow graph
 */
export function buildTextToImageWorkflow({
  checkpoint,
  prompt,
  negative = 'lowres, blurry, watermark, text, deformed',
  width = 1024,
  height = 1024,
  steps = 28,
  cfg = 6.5,
  seed = 0,
  sampler = 'dpmpp_2m',
  scheduler = 'karras',
  batchSize = 1,
  filenamePrefix = 'gen',
}) {
  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: checkpoint },
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: { text: prompt, clip: ['1', 1] },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: { text: negative, clip: ['1', 1] },
    },
    '4': {
      class_type: 'EmptyLatentImage',
      inputs: { width, height, batch_size: batchSize },
    },
    '5': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
        seed,
        steps,
        cfg,
        sampler_name: sampler,
        scheduler,
        denoise: 1.0,
      },
    },
    '6': {
      class_type: 'VAEDecode',
      inputs: { samples: ['5', 0], vae: ['1', 2] },
    },
    '7': {
      class_type: 'SaveImage',
      inputs: { images: ['6', 0], filename_prefix: filenamePrefix },
    },
  };
}

export default buildTextToImageWorkflow;
