import { createCanvas, fillRect, drawProduct, toPNG } from './png.js';

/**
 * "Oncesi" gorseli: dagilik/renkli arka plan + merkez disi yerlesim.
 * Gercek bir kullanicinin cektigi ham urun fotografini temsil eder.
 */
export function generateInputImage() {
  const c = createCanvas(640, 640, [196, 176, 150]); // kirli bej zemin

  // Dagilik arka plan: yatay renk bantlari
  const bands = [
    [170, 150, 120],
    [150, 170, 140],
    [190, 160, 150],
    [160, 150, 175],
  ];
  for (let i = 0; i < bands.length; i++) {
    fillRect(c, 0, i * 160, 640, 90, bands[i]);
  }
  // Dikkat dagitan birkac obje
  fillRect(c, 40, 60, 80, 80, [120, 90, 70]);
  fillRect(c, 520, 420, 90, 70, [90, 110, 90]);

  // Urun: merkez disi, hafif sola kaymis
  drawProduct(c, 270, 470, 1.0);

  return toPNG(c);
}

/**
 * "Sonrasi" gorseli: temiz beyaz studyo arka plani, merkezli ve buyutulmus urun.
 * Pipeline ciktisinin nasil gorunecegini temsil eder (mock sunucu bunu doner).
 */
export function generateStudioOutput() {
  const c = createCanvas(1280, 1280, [255, 255, 255]); // beyaz studyo
  drawProduct(c, 640, 880, 2.0); // merkezli, 2x (upscale hissi)
  return toPNG(c);
}
