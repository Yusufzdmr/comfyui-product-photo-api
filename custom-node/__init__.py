"""
ComfyUI custom node giris noktasi.
ComfyUI bu paketi yuklerken NODE_CLASS_MAPPINGS sozlugunu okur.
"""
from .studio_nodes import StudioBackgroundComposite, HexColorToImage

# class_type -> sinif
NODE_CLASS_MAPPINGS = {
    "StudioBackgroundComposite": StudioBackgroundComposite,
    "HexColorToImage": HexColorToImage,
}

# Arayuzde gorunen okunakli isimler
NODE_DISPLAY_NAME_MAPPINGS = {
    "StudioBackgroundComposite": "Studio Background Composite",
    "HexColorToImage": "Hex Color -> Image",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
