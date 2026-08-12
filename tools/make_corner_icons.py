#!/usr/bin/env python3
"""Build the four corner car guide icons from black-on-white line art.

The rest of the guide set (front, rear, left, glass, odo) is white 2px
stroke on a transparent 320x180 canvas, so the sources are re-inked to
white and fitted to the same framing.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

W, H = 320, 180
MAX_W, MAX_H = 288, 130
ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = ROOT / "docs" / "icons"

SOURCES = {
    "car-fl.png": ROOT / "art" / "corner-front.png",
    "car-rl.png": ROOT / "art" / "corner-rear.png",
}
MIRRORS = {"car-fr.png": "car-fl.png", "car-rr.png": "car-rl.png"}


def to_white_ink(path: Path) -> Image.Image:
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    alpha = np.clip((235.0 - lum) / 180.0, 0.0, 1.0)
    alpha[alpha < 0.08] = 0.0
    out = np.zeros((*lum.shape, 4), dtype=np.uint8)
    out[:, :, :3] = 255
    out[:, :, 3] = (alpha * 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def fit(img: Image.Image) -> Image.Image:
    img = img.crop(img.getbbox())
    scale = min(MAX_W / img.width, MAX_H / img.height)
    img = img.resize(
        (max(1, round(img.width * scale)), max(1, round(img.height * scale))),
        Image.Resampling.LANCZOS,
    )
    # Pasting through an alpha mask would blend the stroke toward the
    # transparent canvas colour and dim it, so copy the block directly.
    canvas = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    canvas.paste(img, ((W - img.width) // 2, (H - img.height) // 2))
    px = np.asarray(canvas).copy()
    px[:, :, :3] = 255
    return Image.fromarray(px, "RGBA")


def main() -> int:
    rendered = {}
    for name, src in SOURCES.items():
        if not src.exists():
            print(f"missing source: {src}", file=sys.stderr)
            return 1
        rendered[name] = fit(to_white_ink(src))
    for name, base in MIRRORS.items():
        rendered[name] = ImageOps.mirror(rendered[base])
    for name, img in rendered.items():
        img.save(ICON_DIR / name)
        print("wrote", ICON_DIR / name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
