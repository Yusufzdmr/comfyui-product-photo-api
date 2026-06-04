"""
E-TICARET STUDYO NODE'LARI (ComfyUI custom node)
-------------------------------------------------
Bu paket, projedeki pipeline'in "studyo kompozit" adimini ComfyUI icinde
tek bir node olarak sunar. Boylece hem backend (Node.js) hem de ComfyUI node
tarafinda gelistirme yapabildigimizi gosterir.

Node'lar:
  - StudioBackgroundComposite : maskeli urunu duz renkli studyo arka planina
                                yerlestirir, kenar boslugu (padding) ekler.
  - HexColorToImage           : hex renkten duz renkli bir IMAGE uretir.

ComfyUI gorsel tensorleri:  IMAGE -> torch.FloatTensor [B, H, W, C], 0..1
                            MASK  -> torch.FloatTensor [B, H, W],    0..1
"""

import torch
import torch.nn.functional as F


def _hex_to_rgb(hex_str):
    """'FFFFFF' / '#FFFFFF' -> (r, g, b) float 0..1"""
    h = hex_str.strip().lstrip("#")
    if len(h) == 3:  # kisa form: 'FFF'
        h = "".join(c * 2 for c in h)
    try:
        r = int(h[0:2], 16) / 255.0
        g = int(h[2:4], 16) / 255.0
        b = int(h[4:6], 16) / 255.0
    except ValueError:
        r = g = b = 1.0  # hatali girdide beyaz
    return r, g, b


class StudioBackgroundComposite:
    """Maskeli urunu duz renkli studyo arka planina yerlestirir."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "mask": ("MASK",),
                "background_hex": ("STRING", {"default": "FFFFFF"}),
                "padding": ("INT", {"default": 0, "min": 0, "max": 1024, "step": 8}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "composite"
    CATEGORY = "ecommerce/studio"

    def composite(self, image, mask, background_hex, padding):
        # image: [B,H,W,C], mask: [B,H,W]
        b, h, w, c = image.shape
        r, g, bl = _hex_to_rgb(background_hex)
        color = torch.tensor([r, g, bl], dtype=image.dtype, device=image.device)

        # Maske kanal boyutuna genisletilir -> [B,H,W,1]
        if mask.dim() == 3:
            m = mask.unsqueeze(-1)
        else:
            m = mask
        m = m.clamp(0.0, 1.0)

        # Duz renkli arka plan
        bg = color.view(1, 1, 1, 3).expand(b, h, w, 3)

        # Alfa kompozit: urun*maske + arka_plan*(1-maske)
        out = image[..., :3] * m + bg * (1.0 - m)

        # Kenar boslugu (padding): tuvali buyutup ortala
        if padding > 0:
            out = out.permute(0, 3, 1, 2)  # [B,C,H,W]
            out = F.pad(out, (padding, padding, padding, padding), mode="constant", value=0.0)
            # Padding alanini arka plan rengiyle doldur
            pad_mask = torch.ones((b, 1, h, w), dtype=out.dtype, device=out.device)
            pad_mask = F.pad(pad_mask, (padding, padding, padding, padding), value=0.0)
            bg_full = color.view(1, 3, 1, 1).expand(b, 3, h + 2 * padding, w + 2 * padding)
            out = out * pad_mask + bg_full * (1.0 - pad_mask)
            out = out.permute(0, 2, 3, 1).contiguous()  # geri [B,H,W,C]

        return (out,)


class HexColorToImage:
    """Hex renk koddan duz renkli bir IMAGE uretir (arka plan/zemin icin)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "hex": ("STRING", {"default": "FFFFFF"}),
                "width": ("INT", {"default": 1024, "min": 16, "max": 8192, "step": 8}),
                "height": ("INT", {"default": 1024, "min": 16, "max": 8192, "step": 8}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "generate"
    CATEGORY = "ecommerce/studio"

    def generate(self, hex, width, height):
        r, g, b = _hex_to_rgb(hex)
        color = torch.tensor([r, g, b], dtype=torch.float32)
        img = color.view(1, 1, 1, 3).expand(1, height, width, 3).contiguous()
        return (img,)
