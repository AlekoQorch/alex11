#!/usr/bin/env python3
"""Build the four corner car guide icons from line-art sources.

The rest of the guide set (front, rear, left, glass, odo) is a crisp
white line drawing of uniform weight on a transparent 320x180 canvas.
The sources here are black on white and much larger, so they are
thresholded, thickened to survive the downscale, re-inked white and
fitted to the same framing as the other icons.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

W, H = 320, 180
MAX_W, MAX_H = 286, 132
TARGET_STROKE = 2.0
ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = ROOT / "docs" / "icons"

SOURCES = {
    "car-fl.png": ROOT / "art" / "corner-front.png",
    "car-rl.png": ROOT / "art" / "corner-rear.png",
}
MIRRORS = {"car-fr.png": "car-fl.png", "car-rr.png": "car-rl.png"}


def binarize(path: Path) -> Image.Image:
    grey = np.asarray(Image.open(path).convert("L"), dtype=np.float32)
    return Image.fromarray(((grey < 190) * 255).astype(np.uint8), "L")


def stroke_width(mask: Image.Image) -> float:
    """Median length of the horizontal ink runs, i.e. the pen width."""
    ink = np.asarray(mask) > 0
    runs = []
    for row in ink:
        length = 0
        for on in row:
            if on:
                length += 1
            elif length:
                runs.append(length)
                length = 0
        if length:
            runs.append(length)
    return float(np.median(runs)) if runs else 1.0


def thicken(mask: Image.Image, scale: float) -> Image.Image:
    """Grow the stroke so it lands near TARGET_STROKE once downscaled."""
    wanted = TARGET_STROKE / scale
    grow = int(round((wanted - stroke_width(mask)) / 2.0))
    for _ in range(max(0, grow)):
        mask = mask.filter(ImageFilter.MaxFilter(3))
    return mask


def build(path: Path) -> Image.Image:
    mask = binarize(path)
    bbox = mask.getbbox()
    mask = mask.crop(bbox)
    scale = min(MAX_W / mask.width, MAX_H / mask.height)
    mask = thicken(mask, scale)
    mask = mask.resize(
        (max(1, round(mask.width * scale)), max(1, round(mask.height * scale))),
        Image.Resampling.LANCZOS,
    )
    alpha = np.asarray(mask, dtype=np.float32) / 255.0
    rgba = np.zeros((*alpha.shape, 4), dtype=np.uint8)
    rgba[:, :, :3] = 255
    rgba[:, :, 3] = (alpha * 255).astype(np.uint8)
    art = Image.fromarray(rgba, "RGBA")

    canvas = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    canvas.paste(art, ((W - art.width) // 2, (H - art.height) // 2))
    return canvas


def main() -> int:
    icons = {}
    for name, src in SOURCES.items():
        if not src.exists():
            print(f"missing source: {src}", file=sys.stderr)
            return 1
        icons[name] = build(src)
    for name, base in MIRRORS.items():
        icons[name] = ImageOps.mirror(icons[base])
    for name, img in icons.items():
        img.save(ICON_DIR / name)
        print("wrote", ICON_DIR / name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
