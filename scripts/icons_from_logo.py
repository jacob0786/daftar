"""Make every app icon from the generated logo (assets/images/logo-source.png).

Provenance: logo-source.png was generated with Canva's image generator (prompt chosen by the owner:
"Bound daftar - a closed cloth-bound ledger in green with a gold corner/clasp, flat, no text"),
exported at 1024 px on 2026-11-25. This script only cuts it out and resizes it.

Run: .venv python scripts/icons_from_logo.py
"""
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "assets" / "images"
PAPER = (247, 242, 230)  # cream background behind the book


def cut_out(src: Image.Image) -> Image.Image:
    """Remove the flat cream background by flood-filling from the edges, with a soft edge."""
    im = src.convert("RGB")
    w, h = im.size
    px = im.load()
    bg = px[4, 4]

    def far(p):
        return sum(abs(a - b) for a, b in zip(p, bg))

    # Flood fill every pixel connected to the border that looks like background
    seen = bytearray(w * h)
    q = deque((x, y) for x in range(w) for y in (0, h - 1))
    q.extend((x, y) for y in range(h) for x in (0, w - 1))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i] or far(px[x, y]) > 40:
            continue
        seen[i] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))

    mask = Image.new("L", (w, h), 255)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            if seen[y * w + x]:
                mp[x, y] = 0
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))  # anti-aliased edge
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out.crop(out.getbbox())


def place(art: Image.Image, size: int, fill: float, bg=None) -> Image.Image:
    """Centre the artwork so its longest side takes `fill` of the canvas."""
    canvas = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    scale = fill * size / max(art.size)
    a = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    canvas.alpha_composite(a, ((size - a.width) // 2, (size - a.height) // 2))
    return canvas


def main():
    book = cut_out(Image.open(IMG / "logo-source.png"))

    # Android adaptive icon: the book sits inside the 66% safe zone on a paper background layer
    place(book, 1024, 0.56).save(IMG / "android-icon-foreground.png")
    Image.new("RGBA", (1024, 1024), PAPER + (255,)).save(IMG / "android-icon-background.png")
    # Monochrome (themed icons): white silhouette
    alpha = place(book, 1024, 0.56).getchannel("A")
    mono = Image.new("RGBA", (1024, 1024), (255, 255, 255, 0))
    mono.putalpha(alpha)
    mono.save(IMG / "android-icon-monochrome.png")

    # Legacy / store / desktop icon: book on paper, rounded square left to the launcher
    full = place(book, 1024, 0.78, PAPER + (255,))
    full.save(IMG / "icon.png")
    # Splash: the book alone (splash background colour is paper)
    place(book, 1024, 0.9).save(IMG / "splash-icon.png")
    # Browser / desktop favicon
    full.resize((48, 48), Image.LANCZOS).save(IMG / "favicon.png")
    print("Icons written to", IMG)


if __name__ == "__main__":
    main()
