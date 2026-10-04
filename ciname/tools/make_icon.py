"""Draws the Ciname app icon: Anikku's crescent turned into a "C", shaded from Cinejoy's lime to
Anikku's orange, with a play button where Anikku's dot sits.
usage: python ciname/tools/make_icon.py   ->  ciname/Assets.xcassets/AppIcon.appiconset/icon-1024.png
                                              ciname/Launcher/ciname.png (for the picker screen)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parent.parent
S = 4096                      # drawn large, scaled down for smooth edges
U = S / 34                    # the Anikku mark is drawn on a 34-unit grid

def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

def gradient(size, stops):
    """Diagonal gradient, top-left to bottom-right, through the given colour stops."""
    w, h = size
    small = Image.new("RGB", (256, 256))
    px = small.load()
    for y in range(256):
        for x in range(256):
            t = (x + y) / 510
            for i in range(len(stops) - 1):
                (p0, c0), (p1, c1) = stops[i], stops[i + 1]
                if p0 <= t <= p1:
                    px[x, y] = lerp(c0, c1, (t - p0) / (p1 - p0))
                    break
    return small.resize((w, h), Image.BICUBIC)

def circle(draw, cx, cy, r, fill):
    draw.ellipse([(cx - r) * U, (cy - r) * U, (cx + r) * U, (cy + r) * U], fill=fill)

LIME, GOLD, ORANGE, EMBER = (149, 255, 80), (255, 214, 64), (255, 128, 32), (240, 74, 30)

def mark(size):
    """The crescent "C" with its play button, as RGBA at the given size."""
    shape = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(shape)
    circle(d, 17, 17, 13.2, 255)        # outer disc, a little smaller than Anikku's for icon padding
    circle(d, 20.6, 15.2, 7.6, 0)       # the hole that makes it a crescent
    fill = gradient((S, S), [(0, LIME), (0.2, LIME), (0.48, GOLD), (0.68, ORANGE), (1, EMBER)])
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(fill, (0, 0), shape)

    # play button sitting in the crescent's opening
    cx, cy, r = 21.1 * U, 15.2 * U, 3.3 * U
    tri = Image.new("L", (S, S), 0)
    td = ImageDraw.Draw(tri)
    td.polygon([(cx - r * 0.62, cy - r), (cx - r * 0.62, cy + r), (cx + r * 1.05, cy)], fill=255)
    tri = tri.filter(ImageFilter.GaussianBlur(S / 400)).point(lambda v: 255 if v > 110 else 0)  # soften the corners
    out.paste(Image.new("RGBA", (S, S), (255, 248, 238, 255)), (0, 0), tri)
    return out.resize((size, size), Image.LANCZOS)

def icon():
    bg = Image.new("RGB", (S, S), (10, 10, 14))
    # two soft glows, lime top-left and orange bottom-right, like the picker screen
    glow = Image.new("RGB", (S, S), (0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse([-S * 0.35, -S * 0.35, S * 0.45, S * 0.45], fill=(30, 52, 14))
    g.ellipse([S * 0.55, S * 0.55, S * 1.35, S * 1.35], fill=(58, 24, 6))
    glow = glow.resize((S // 16, S // 16), Image.BILINEAR).filter(ImageFilter.GaussianBlur(S / 16 / 5)).resize((S, S), Image.BICUBIC)
    bg = ImageChops.add(bg, glow)
    m = mark(S)
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shadow.paste(Image.new("RGBA", (S, S), (0, 0, 0, 170)), (0, int(S * 0.012)), m.split()[3])
    shadow = shadow.filter(ImageFilter.GaussianBlur(S / 70))
    out = bg.convert("RGBA")
    out.alpha_composite(shadow)
    out.alpha_composite(m)
    return out.convert("RGB").resize((1024, 1024), Image.LANCZOS)

if __name__ == "__main__":
    dest = ROOT / "Assets.xcassets" / "AppIcon.appiconset" / "icon-1024.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    icon().save(dest)
    (ROOT / "Launcher").mkdir(exist_ok=True)
    mark(256).save(ROOT / "Launcher" / "ciname.png")
    print("wrote", dest)
