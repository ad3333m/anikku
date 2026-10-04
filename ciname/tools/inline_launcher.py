"""Copies the Ciname picker into the app as one file: the icons it shows become data: URIs, because the
page is loaded with an https origin (so it can fetch the poster walls) and can't reach bundle files.
usage: python3 ciname/tools/inline_launcher.py <out-dir>   ->  <out-dir>/launcher.html
"""
import base64
import re
import sys
from pathlib import Path

launcher = Path(__file__).resolve().parent.parent / "Launcher"
out = Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=True)

def inline(match):
    data = base64.b64encode((launcher / match.group(1)).read_bytes()).decode()
    return f'src="data:image/png;base64,{data}"'

html = re.sub(r'src="([\w-]+\.png)"', inline, (launcher / "launcher.html").read_text(encoding="utf-8"))
assert ".png\"" not in html, "an image was left as a file reference"
(out / "launcher.html").write_text(html, encoding="utf-8")
print(f"picker -> {out / 'launcher.html'} ({len(html) // 1024} KB)")
