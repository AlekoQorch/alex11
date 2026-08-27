#!/usr/bin/env python3
"""Render the four corner car-photo guides in the same minimal outline style.

The front/rear/side guides already use a clean, white 2px outline with rounded
joins.  Corner views use this one authored vector system rather than separate
illustrations, so a left/right pair is geometrically identical after mirroring.
"""

from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image, ImageOps


WIDTH, HEIGHT, SCALE = 320, 180, 4
ICON_DIR = Path(__file__).resolve().parents[1] / "docs" / "icons"
STYLE = (
    'fill="none" stroke="#fff" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round"'
)


def svg(paths: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}">'
        f'<g {STYLE}>{paths}</g></svg>'
    )


FRONT_LEFT = svg(
    """
    <!-- outer sedan silhouette -->
    <path d="M25 119v-13c0-8 5-14 13-17l47-13 28-27c8-7 19-11 30-12
             27-3 55-2 76 3 15 3 28 11 37 22l27 12c9 4 14 12 14 21v15"/>
    <path d="M25 119v8c0 5 4 8 9 8h15M276 135h12c5 0 9-4 9-9v-11"/>
    <!-- glass and simple door geometry -->
    <path d="M86 76l28-27c7-7 18-10 29-11 25-3 51-2 73 3 13 3 25 11 34 22"/>
    <path d="M112 48l-10 42M102 90l163-5M164 41l2 43M165 85l2 44"/>
    <path d="M216 85l2 42M190 99h13M230 97h12"/>
    <!-- one mirror, lamps, grille and bumper -->
    <path d="M104 75c-7-3-12-1-13 4s5 7 12 5"/>
    <path d="M37 96c9-5 21-7 33-6M81 91c8-3 16-3 23-1"/>
    <rect x="41" y="104" width="50" height="15" rx="6"/>
    <path d="M38 126h67M105 122h18"/>
    <!-- main pair of wheels -->
    <circle cx="132" cy="128" r="19"/><circle cx="132" cy="128" r="9"/>
    <circle cx="247" cy="123" r="17"/><circle cx="247" cy="123" r="8"/>
    <path d="M110 128c1-17 10-27 22-27s21 10 22 27"/>
    <path d="M227 123c1-15 9-24 20-24s19 9 20 23"/>
    <!-- far front tire: only lower rim appears below its bumper -->
    <path d="M65 134c0-9 6-14 14-14s14 5 14 14"/>
    """
)


REAR_LEFT = svg(
    """
    <!-- outer sedan silhouette -->
    <path d="M25 116v-17c0-8 5-14 13-17l22-7 26-25c8-8 19-12 31-14
             27-4 54-3 76 2 16 3 30 11 40 22l42 16c10 4 16 12 16 22v17"/>
    <path d="M25 116v10c0 5 4 9 9 9h16M274 135h13c5 0 9-4 9-9v-10"/>
    <!-- rear window and side glass -->
    <path d="M60 75l26-25c8-8 19-11 31-13 25-3 51-2 74 3 14 3 27 11 37 22"/>
    <path d="M116 38l-3 43M60 81l171 3M167 42l3 43M169 85l2 43"/>
    <path d="M218 86l3 42M189 99h13M229 101h12"/>
    <!-- mirror, tail lamps and simple plate -->
    <path d="M229 84c7-3 12-1 13 4 1 5-5 7-12 5"/>
    <rect x="35" y="94" width="29" height="12" rx="5"/>
    <rect x="75" y="95" width="28" height="12" rx="5"/>
    <rect x="47" y="113" width="43" height="13" rx="3"/>
    <path d="M35 129h65M96 131h15"/>
    <!-- main pair of wheels -->
    <circle cx="130" cy="128" r="19"/><circle cx="130" cy="128" r="9"/>
    <circle cx="251" cy="130" r="17"/><circle cx="251" cy="130" r="8"/>
    <path d="M108 128c1-17 10-27 22-27s21 10 22 27"/>
    <path d="M231 130c1-15 9-24 20-24s19 9 20 23"/>
    <!-- far rear tire tucked under the bumper -->
    <path d="M48 136c0-9 6-14 14-14s14 5 14 14"/>
    """
)


def render(markup: str) -> Image.Image:
    png = cairosvg.svg2png(
        bytestring=markup.encode(),
        output_width=WIDTH * SCALE,
        output_height=HEIGHT * SCALE,
    )
    return Image.open(BytesIO(png)).convert("RGBA").resize(
        (WIDTH, HEIGHT), Image.Resampling.LANCZOS
    )


def main() -> None:
    front = render(FRONT_LEFT)
    rear = render(REAR_LEFT)
    icons = {
        "car-fl.png": front,
        "car-fr.png": ImageOps.mirror(front),
        "car-rl.png": rear,
        "car-rr.png": ImageOps.mirror(rear),
    }
    for name, image in icons.items():
        image.save(ICON_DIR / name)
        print(f"wrote {name}")


if __name__ == "__main__":
    main()
