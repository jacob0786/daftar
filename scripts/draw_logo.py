"""Draw the Daftar logo (assets/images/logo-source.png) as clean flat shapes.

Same notebook as the original generated logo (green cover, darker spine, gold stitching,
gold corner, gold clasp, cream pages), but the right-hand side is rounded so the book
reads a little like a "D". Change CURVE to make that rounder or squarer.

Run: python scripts/draw_logo.py   then   python scripts/icons_from_logo.py
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "images" / "logo-source.png"

S = 4  # draw 4x bigger, then shrink, for smooth edges
GREEN = (10, 79, 52)
SPINE = (7, 64, 41)
GOLD = (236, 180, 64)
PAGE = (247, 240, 222)
WHITE = (253, 253, 253)

# Cover box (in the final 1024px canvas) and corner radii
X0, Y0, X1, Y1 = 196, 112, 772, 912
LEFT_R = 22
CURVE = 150  # radius of the rounded right-hand corners: the "D" curve


def d(v):
    return round(v * S)


def d_shape(x0, y0, x1, y1, left_r, right_r):
    """Mask of a rectangle with small left corners and big right corners."""
    m = Image.new("L", (d(1024), d(1024)), 0)
    a = ImageDraw.Draw(m)
    a.rounded_rectangle([d(x0), d(y0), d(x1), d(y1)], radius=d(right_r), fill=255)
    b = Image.new("L", m.size, 0)
    ImageDraw.Draw(b).rounded_rectangle([d(x0), d(y0), d(x1 - right_r), d(y1)], radius=d(left_r), fill=255)
    return ImageChops.lighter(m, b)


def paint(img, mask, colour):
    img.paste(Image.new("RGB", img.size, colour), (0, 0), mask)


def main():
    img = Image.new("RGB", (d(1024), d(1024)), WHITE)

    # 1. Pages peeking out on the right, following the same curve (green outline, cream inside)
    paint(img, d_shape(X0 + 40, Y0 + 22, X1 + 34, Y1 - 22, LEFT_R, CURVE), GREEN)
    paint(img, d_shape(X0 + 40, Y0 + 31, X1 + 25, Y1 - 31, LEFT_R, CURVE - 9), PAGE)

    # 2. The cover
    cover = d_shape(X0, Y0, X1, Y1, LEFT_R, CURVE)
    paint(img, cover, GREEN)

    # 3. Darker spine strip on the left, kept inside the cover
    spine = Image.new("L", img.size, 0)
    ImageDraw.Draw(spine).rectangle([d(X0), d(Y0), d(X0 + 38), d(Y1)], fill=255)
    paint(img, ImageChops.multiply(spine, cover), SPINE)

    # 4. Gold stitching down the spine
    draw = ImageDraw.Draw(img)
    x = X0 + 64
    y = Y0 + 22
    while y < Y1 - 22:
        draw.rounded_rectangle([d(x - 3.5), d(y), d(x + 3.5), d(min(y + 26, Y1 - 22))], radius=d(3.5), fill=GOLD)
        y += 40

    # 5. Gold corner, cut to the curved edge
    corner = Image.new("L", img.size, 0)
    ImageDraw.Draw(corner).polygon([(d(X1 - 200), d(Y0)), (d(X1 + 2), d(Y0)), (d(X1 + 2), d(Y0 + 202))], fill=255)
    paint(img, ImageChops.multiply(corner, cover), GOLD)

    # 6. The clasp: a gold tab with a pointed end, over the page edge
    cy, hh = (Y0 + Y1) / 2, 56
    tip, body, end = X1 - 172, X1 - 128, X1 + 58
    pts = [(tip, cy), (body, cy - hh), (end, cy - hh), (end, cy + hh), (body, cy + hh)]
    draw.polygon([(d(px), d(py)) for px, py in pts], fill=GOLD)
    draw.rounded_rectangle([d(end - 16), d(cy - hh), d(end + 8), d(cy + hh)], radius=d(14), fill=GOLD)  # rounded far end
    # Green inner line tracing the tab
    i = 16
    inner = [(end - 8, cy - hh + i), (body + 6, cy - hh + i), (tip + 22, cy), (body + 6, cy + hh - i), (end - 8, cy + hh - i)]
    draw.line([(d(px), d(py)) for px, py in inner], fill=GREEN, width=d(9), joint="curve")

    img.resize((1024, 1024), Image.LANCZOS).save(OUT)
    print("Logo written to", OUT)


if __name__ == "__main__":
    main()
