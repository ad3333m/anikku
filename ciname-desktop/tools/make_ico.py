"""Builds assets/ciname.ico (16..256 px) from the Ciname icon art in ciname/tools/make_icon.py.
usage: python ciname-desktop/tools/make_ico.py"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE.parent / "ciname" / "tools"))
import make_icon  # noqa: E402

full = make_icon.icon().convert("RGBA")
# round the square like a Windows 11 app tile, so it doesn't sit as a hard square on the taskbar
mask = Image.new("L", (4096, 4096), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, 4095, 4095], radius=900, fill=255)
full.putalpha(mask.resize(full.size, Image.LANCZOS))
out = HERE / "assets" / "ciname.ico"
full.save(out, sizes=[(16, 16), (20, 20), (24, 24), (32, 32), (40, 40), (48, 48), (64, 64), (128, 128), (256, 256)])
print("wrote", out)
