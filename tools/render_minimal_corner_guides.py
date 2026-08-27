#!/usr/bin/env python3
"""Render uncluttered corner guides with the same white 2px outline language."""

from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image, ImageOps


W, H, SCALE = 320, 180, 4
ICON_DIR = Path(__file__).resolve().parents[1] / "docs" / "icons"
STYLE = 'fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'


def drawing(paths: str) -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><g {STYLE}>{paths}</g></svg>'


# These keep exactly the amount of information in the straight-on icons:
# body, glass, one body separation, one lamp treatment, bumper and two wheels.
FRONT_LEFT = drawing("""
  <path d="M30 121v-15c0-7 4-12 12-15l46-14 27-25c9-8 20-11 32-12
           24-3 50-2 71 3 15 4 28 12 37 24l26 12c8 4 13 11 13 20v18"/>
  <path d="M30 121v7c0 5 4 8 9 8h18M274 136h13c5 0 9-4 9-9v-10"/>
  <!-- one continuous glass area, one pillar, one door split -->
  <path d="M88 77l27-25c8-8 19-11 31-12 23-3 48-2 69 3 14 4 25 11 35 24"/>
  <path d="M115 52l-10 37M105 89l160-5M168 41l2 43M217 85l2 42"/>
  <!-- only the essentials of a front fascia -->
  <path d="M106 75c-7-3-12-1-13 4s5 7 12 5"/>
  <rect x="44" y="104" width="49" height="15" rx="6"/>
  <path d="M42 95c9-5 20-6 31-5M86 90c8-3 15-3 22-1"/>
  <path d="M40 126h66"/>
  <!-- simple, fully visible near-side wheels -->
  <circle cx="136" cy="128" r="18"/><circle cx="136" cy="128" r="8"/>
  <circle cx="250" cy="124" r="16"/><circle cx="250" cy="124" r="7"/>
""")


REAR_LEFT = drawing("""
  <path d="M30 118v-18c0-7 4-12 12-15l23-8 25-24c9-8 20-12 32-13
           24-3 50-2 72 3 15 4 28 12 38 24l40 16c9 4 14 11 14 20v19"/>
  <path d="M30 118v9c0 5 4 8 9 8h18M272 135h14c5 0 9-4 9-9v-9"/>
  <!-- one continuous glass area, one pillar, one door split -->
  <path d="M65 77l25-24c9-8 20-12 32-13 24-3 49-2 71 3 14 4 26 11 36 24"/>
  <path d="M119 41l-3 42M65 83l166 3M170 44l3 42M219 86l3 42"/>
  <!-- only the essentials of a rear fascia -->
  <path d="M230 84c7-3 12-1 13 4 1 5-5 7-12 5"/>
  <rect x="38" y="95" width="28" height="12" rx="5"/>
  <rect x="77" y="96" width="28" height="12" rx="5"/>
  <rect x="48" y="113" width="42" height="13" rx="3"/>
  <path d="M38 130h65"/>
  <!-- simple, fully visible near-side wheels -->
  <circle cx="132" cy="128" r="18"/><circle cx="132" cy="128" r="8"/>
  <circle cx="251" cy="130" r="16"/><circle cx="251" cy="130" r="7"/>
""")


def render(markup: str) -> Image.Image:
    data = cairosvg.svg2png(
        bytestring=markup.encode(), output_width=W * SCALE, output_height=H * SCALE
    )
    return Image.open(BytesIO(data)).convert("RGBA").resize((W, H), Image.Resampling.LANCZOS)


def main() -> None:
    front, rear = render(FRONT_LEFT), render(REAR_LEFT)
    icons = {
        "car-fl.png": front,
        "car-fr.png": ImageOps.mirror(front),
        "car-rl.png": rear,
        "car-rr.png": ImageOps.mirror(rear),
    }
    for filename, image in icons.items():
        image.save(ICON_DIR / filename)


if __name__ == "__main__":
    main()
