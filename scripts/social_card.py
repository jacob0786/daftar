"""Make docs/social-card.png: a 1200x630 image for sharing the GitHub link (WhatsApp, X, LinkedIn, GitHub preview).

Run: python scripts/social_card.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "social-card.png"
FONTS = Path("C:/Windows/Fonts")

PAPER = (247, 242, 230)
GREEN = (10, 79, 52)
INK = (30, 36, 32)
MUTED = (96, 106, 99)
GOLD = (196, 140, 30)


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def main():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)

    # A slightly deeper paper band down the left with the book on it
    d.rectangle([0, 0, 430, H], fill=(234, 225, 203))
    book = Image.open(ROOT / "assets" / "images" / "splash-icon.png").convert("RGBA")
    book = book.crop(book.getbbox())
    scale = 400 / book.height
    book = book.resize((round(book.width * scale), 400), Image.LANCZOS)
    img.paste(book, ((430 - book.width) // 2, (H - 400) // 2), book)

    # Name, line, features, link
    x = 500
    d.text((x, 110), "Daftar", font=font("segoeuib.ttf", 96), fill=INK)
    d.text((x, 235), "Free notes and checklists for", font=font("segoeui.ttf", 38), fill=INK)
    d.text((x, 283), "Android and Windows", font=font("segoeui.ttf", 38), fill=INK)
    feats = ["Calendar with Hijri dates", "Locked notes, encrypted", "Sync with your own database", "Open source, no ads"]
    y = 370
    for f in feats:
        d.ellipse([x, y + 12, x + 12, y + 24], fill=GOLD)
        d.text((x + 28, y), f, font=font("segoeui.ttf", 28), fill=MUTED)
        y += 44
    d.text((x, H - 62), "github.com/jacob0786/daftar", font=font("segoeuib.ttf", 28), fill=GREEN)

    OUT.parent.mkdir(exist_ok=True)
    img.save(OUT)
    print("Saved", OUT)


if __name__ == "__main__":
    main()
