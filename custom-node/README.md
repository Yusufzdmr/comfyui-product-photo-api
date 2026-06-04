# E-Ticaret Stüdyo Custom Node'ları (ComfyUI)

Projedeki "stüdyo kompozit" adımını **ComfyUI içinde tek bir node** olarak sunan
örnek bir Python custom node paketi. Backend orchestration'ın yanında, ComfyUI'ın
**node API'sine** de hâkim olunduğunu gösterir.

## Node'lar

| Node | Girdi | Çıktı | İşlev |
|------|-------|-------|-------|
| **Studio Background Composite** | `IMAGE`, `MASK`, `background_hex`, `padding` | `IMAGE` | Maskeli ürünü düz renkli stüdyo arka planına yerleştirir, kenar boşluğu ekler |
| **Hex Color → Image** | `hex`, `width`, `height` | `IMAGE` | Hex renkten düz renkli zemin görseli üretir |

Her ikisi de arayüzde `ecommerce/studio` kategorisi altında görünür.

## Kurulum

```bash
# ComfyUI/custom_nodes/ altına kopyalayın
cp -r custom-node /yol/ComfyUI/custom_nodes/comfyui-ecommerce-studio
# ComfyUI'ı yeniden başlatın
```

`torch` zaten ComfyUI ile gelir; ek bağımlılık yoktur.

## Kullanım (workflow içinde)

```
LoadImage ─► (rembg) ─► [Studio Background Composite] ─► (Upscale) ─► SaveImage
                MASK ─────────────┘
```

`background_hex` = `F5F5F5`, `padding` = `64` gibi değerlerle ürünü ortalanmış,
nefes alanı olan bir stüdyo görseline dönüştürür. Bu node, kök dizindeki
Node.js pipeline'ının yaptığı kompozit işini ComfyUI grafiği içinde de
yapılabilir kılar.

## Node API notları

- `INPUT_TYPES` ile tipli girişler (`IMAGE`, `MASK`, `STRING`, `INT`) tanımlanır.
- Görseller `torch.FloatTensor [B, H, W, C]` (0..1), maskeler `[B, H, W]` formatındadır.
- Kompozit: `çıktı = ürün * maske + arka_plan * (1 - maske)` (alfa harmanlama).
