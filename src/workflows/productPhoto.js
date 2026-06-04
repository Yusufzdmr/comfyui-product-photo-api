/**
 * E-TICARET URUN FOTOGRAFI WORKFLOW'U (API format)
 * --------------------------------------------------
 * Akis:
 *   LoadImage -> Arka plan temizleme (rembg) -> Studyo arka plani uzerine kompozit
 *             -> AI upscale -> Kaydet
 *
 * ComfyUI'in "API format"i, node_id -> { class_type, inputs } seklinde bir sozluktur.
 * Node'lar birbirine [kaynak_node_id, cikis_indexi] referanslariyla baglanir.
 *
 * Gerekli custom node paketleri (README'de detayli):
 *   - rembg node'u  (class_type: "Image Remove Background (rembg)")
 *   - ComfyUI_essentials (class_type: "GetImageSize+")
 *   - bir upscale modeli (ornek: 4x-UltraSharp.pth)
 */

/** Arka plan temizleme node'unun class_type'i. Kullandigin pakete gore degistirilebilir. */
const BG_REMOVAL_CLASS = 'Image Remove Background (rembg)';

/** Hex renk ("FFFFFF") -> EmptyImage node'unun bekledigi integer (0xRRGGBB). */
function hexToInt(hex) {
  return parseInt(String(hex).replace('#', ''), 16) || 0xffffff;
}

/**
 * @param {object} params
 * @param {string} params.imageName     ComfyUI input klasorundeki yuklenmis dosya adi
 * @param {string} params.upscaleModel  upscale_models altindaki model dosyasi
 * @param {string} [params.bgColor]     studyo arka plan rengi (hex, varsayilan beyaz)
 * @param {boolean} [params.upscale]    upscale adimi acik mi (varsayilan true)
 * @param {string} [params.filenamePrefix]
 * @returns {object} API formatinda workflow graph
 */
export function buildProductPhotoWorkflow({
  imageName,
  upscaleModel,
  bgColor = 'FFFFFF',
  upscale = true,
  filenamePrefix = 'urun',
}) {
  const graph = {
    // 1) Yuklenen urun gorselini yukle
    '1': {
      class_type: 'LoadImage',
      inputs: { image: imageName },
    },

    // 2) Arka plani temizle -> IMAGE (rgba) + MASK
    '2': {
      class_type: BG_REMOVAL_CLASS,
      inputs: {
        image: ['1', 0],
        transparency: true,
        model: 'u2net',
        post_processing: false,
        only_mask: false,
        alpha_matting: true,
        alpha_matting_foreground_threshold: 240,
        alpha_matting_background_threshold: 10,
        alpha_matting_erode_size: 10,
      },
    },

    // 3) Orijinal boyutu al (studyo arka planini ayni olcude uretmek icin)
    '3': {
      class_type: 'GetImageSize+',
      inputs: { image: ['1', 0] },
    },

    // 4) Duz renkli studyo arka plani uret
    '4': {
      class_type: 'EmptyImage',
      inputs: {
        width: ['3', 0],
        height: ['3', 1],
        batch_size: 1,
        color: hexToInt(bgColor),
      },
    },

    // 5) Urunu (maskeli) studyo arka plani uzerine yerlestir
    '5': {
      class_type: 'ImageCompositeMasked',
      inputs: {
        destination: ['4', 0],
        source: ['2', 0],
        x: 0,
        y: 0,
        resize_source: false,
        mask: ['2', 1],
      },
    },
  };

  // Kompozit sonucu: upscale acik ise modelden gecir, degilse dogrudan kaydet
  let finalImageRef = ['5', 0];

  if (upscale) {
    graph['6'] = {
      class_type: 'UpscaleModelLoader',
      inputs: { model_name: upscaleModel },
    };
    graph['7'] = {
      class_type: 'ImageUpscaleWithModel',
      inputs: { upscale_model: ['6', 0], image: ['5', 0] },
    };
    finalImageRef = ['7', 0];
  }

  // Sonucu kaydet
  graph['8'] = {
    class_type: 'SaveImage',
    inputs: { images: finalImageRef, filename_prefix: filenamePrefix },
  };

  return graph;
}

export default buildProductPhotoWorkflow;
