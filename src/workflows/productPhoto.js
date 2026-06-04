/**
 * E-TICARET URUN FOTOGRAFI WORKFLOW'U (API format)
 * --------------------------------------------------
 * Akis:
 *   LoadImage -> Arka plan temizleme (rembg, RGBA) -> alpha'dan maske
 *             -> Studyo arka plani uzerine kompozit -> (opsiyonel) AI upscale -> Kaydet
 *
 * ComfyUI'in "API format"i, node_id -> { class_type, inputs } seklinde bir sozluktur.
 * Node'lar birbirine [kaynak_node_id, cikis_indexi] referanslariyla baglanir.
 *
 * NOT: Bu graph, calisan bir ComfyUI uzerinde /object_info ile DOGRULANMIS node
 * imzalarina gore kurulmustur (gercek bir CPU kurulumunda uctan uca test edildi).
 *
 * Gerekli custom node paketleri:
 *   - rembg node'u       (class_type: "Image Remove Background (rembg)") -> tek RGBA cikis
 *   - ComfyUI_essentials (class_type: "GetImageSize+")
 * Cekirdek node'lar (ekstra paket gerektirmez):
 *   - SplitImageWithAlpha, ImageToMask, EmptyImage, ImageCompositeMasked,
 *     UpscaleModelLoader, ImageUpscaleWithModel, LoadImage, SaveImage
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

    // 2) Arka plani temizle -> RGBA (arka plan saydam)
    '2': {
      class_type: BG_REMOVAL_CLASS,
      inputs: { image: ['1', 0] },
    },

    // 3) RGBA'dan temiz RGB goruntuyu ayikla (kompozit kaynagi)
    '3': {
      class_type: 'SplitImageWithAlpha',
      inputs: { image: ['2', 0] },
    },

    // 4) Alpha kanalindan on plan (urun) maskesi
    '4': {
      class_type: 'ImageToMask',
      inputs: { image: ['2', 0], channel: 'alpha' },
    },

    // 5) Orijinal boyutu al (studyo arka planini ayni olcude uretmek icin)
    '5': {
      class_type: 'GetImageSize+',
      inputs: { image: ['1', 0] },
    },

    // 6) Duz renkli studyo arka plani uret
    '6': {
      class_type: 'EmptyImage',
      inputs: {
        width: ['5', 0],
        height: ['5', 1],
        batch_size: 1,
        color: hexToInt(bgColor),
      },
    },

    // 7) Urunu (maskeli) studyo arka plani uzerine yerlestir
    '7': {
      class_type: 'ImageCompositeMasked',
      inputs: {
        destination: ['6', 0],
        source: ['3', 0],
        x: 0,
        y: 0,
        resize_source: false,
        mask: ['4', 0],
      },
    },
  };

  // Kompozit sonucu: upscale acik ise modelden gecir, degilse dogrudan kaydet
  let finalImageRef = ['7', 0];

  if (upscale) {
    graph['8'] = {
      class_type: 'UpscaleModelLoader',
      inputs: { model_name: upscaleModel },
    };
    graph['9'] = {
      class_type: 'ImageUpscaleWithModel',
      inputs: { upscale_model: ['8', 0], image: ['7', 0] },
    };
    finalImageRef = ['9', 0];
  }

  // Sonucu kaydet
  graph['10'] = {
    class_type: 'SaveImage',
    inputs: { images: finalImageRef, filename_prefix: filenamePrefix },
  };

  return graph;
}

export default buildProductPhotoWorkflow;
