"""Builds Ciname TV's launcher icons and the Google TV home-row banner from the Ciname icon art
(ciname/tools/make_icon.py), each drawn at its own size so it stays sharp when a 4K panel enlarges it.

  mipmap-*/ic_launcher.png, ic_launcher_round.png   48..192 px
  mipmap-*/ic_launcher_foreground.png                108dp adaptive canvas, art inside the 72dp safe zone
  drawable-*/tv_banner.png                            160x90dp, what Google TV shows on the home row

    python ciname-tv/tools/make_icons.py      (needs Pillow and a bold system font)
"""
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE.parent / "ciname" / "tools"))
import make_icon  # noqa: E402  (the Ciname icon art)

RES = HERE / "app" / "src" / "main" / "res"
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
FONTS = ["C:/Windows/Fonts/seguibl.ttf", "C:/Windows/Fonts/segoeuib.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]

def font(size):
    for f in FONTS:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()

def main():
    full = make_icon.icon()                       # 1024 square, background included
    mark = make_icon.mark(1024)                   # the crescent alone, transparent
    for name, k in DENSITIES.items():
        d = RES / f"mipmap-{name}"
        d.mkdir(parents=True, exist_ok=True)
        n = round(48 * k)
        full.resize((n, n), Image.LANCZOS).save(d / "ic_launcher.png")
        rnd = Image.new("RGBA", (n, n), (0, 0, 0, 0))
        m = Image.new("L", (n * 4, n * 4), 0)
        ImageDraw.Draw(m).ellipse([0, 0, n * 4 - 1, n * 4 - 1], fill=255)
        rnd.paste(full.resize((n, n), Image.LANCZOS), (0, 0), m.resize((n, n), Image.LANCZOS))
        rnd.save(d / "ic_launcher_round.png")
        c = round(108 * k)
        fg = Image.new("RGBA", (c, c), (0, 0, 0, 0))
        art = round(72 * k * 0.92)
        fg.alpha_composite(mark.resize((art, art), Image.LANCZOS), ((c - art) // 2, (c - art) // 2))
        fg.save(d / "ic_launcher_foreground.png")

        # banner: dark glass with Cinejoy-lime and Anikku-orange glows, the crescent, and the name
        w, h = round(160 * k), round(90 * k)
        S = 4
        W, H = w * S, h * S
        banner = Image.new("RGB", (W, H), (10, 10, 14))
        glow = Image.new("RGB", (W // 8, H // 8), (0, 0, 0))
        g = ImageDraw.Draw(glow)
        g.ellipse([-W // 16, -H // 8, W // 8 * 0.55, H // 8 * 1.1], fill=(34, 60, 16))
        g.ellipse([W // 8 * 0.6, -H // 16, W // 8 * 1.3, H // 8 * 1.2], fill=(66, 28, 8))
        glow = glow.filter(ImageFilter.GaussianBlur(H // 8 / 4)).resize((W, H), Image.BICUBIC)
        banner = ImageChops.add(banner, glow).convert("RGBA")
        mk = round(H * 0.7)
        mx = round(W * 0.06)
        banner.alpha_composite(mark.resize((mk, mk), Image.LANCZOS), (mx, (H - mk) // 2))
        text = "Ciname"
        x0 = mx + mk + round(W * 0.045)
        room = W - x0 - round(W * 0.06)
        size = round(H * 0.42)
        while True:
            f = font(size)
            box = ImageDraw.Draw(banner).textbbox((0, 0), text, font=f)
            if box[2] - box[0] <= room or size < 10:
                break
            size -= 2
        th = box[3] - box[1]
        y0 = (H - th) // 2 - box[1]
        mask = Image.new("L", banner.size, 0)
        ImageDraw.Draw(mask).text((x0 - box[0], y0), text, font=f, fill=255)
        grad = make_icon.gradient(banner.size, [(0, make_icon.LIME), (0.45, make_icon.GOLD), (0.75, make_icon.ORANGE), (1, make_icon.EMBER)])
        banner.paste(grad, (0, 0), mask)
        dd = RES / f"drawable-{name}"
        dd.mkdir(parents=True, exist_ok=True)
        banner.convert("RGB").resize((w, h), Image.LANCZOS).save(dd / "tv_banner.png")
    print("icons and banner written under", RES)

if __name__ == "__main__":
    main()
