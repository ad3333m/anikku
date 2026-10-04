"""Packs the site in docs/ into one self-contained page for the iOS app: the JS modules are bundled
with esbuild and inlined together with the CSS, so the app needs no web server or GitHub Pages.
usage: python3 ios/bundle_web.py <out-dir>   ->  <out-dir>/index.html and <out-dir>/skin.js
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
docs = root / "docs"
out = Path(sys.argv[1] if len(sys.argv) > 1 else root / "ios" / "Web").resolve()
out.mkdir(parents=True, exist_ok=True)
tmp_js = out / "_app.bundle.js"

npx = shutil.which("npx") or shutil.which("npx.cmd")
subprocess.run([npx, "--yes", "esbuild@0.24.0", str(docs / "js" / "app.js"), "--bundle", "--format=iife",
                "--minify", "--target=safari15", f"--outfile={tmp_js}"], check=True)

html = (docs / "index.html").read_text(encoding="utf-8")
css = (docs / "css" / "app.css").read_text(encoding="utf-8")
js = tmp_js.read_text(encoding="utf-8").replace("</script", "<\\/script")
tmp_js.unlink()

# no manifest/icons inside the app; styles and script inline
html = re.sub(r'\s*<link rel="(icon|apple-touch-icon|manifest)"[^>]*>', "", html)
html = html.replace('<link rel="stylesheet" href="css/app.css">', "<style>\n" + css + "\n</style>")
html = html.replace('<script type="module" src="js/app.js"></script>', "<script>\n" + js + "\n</script>")
assert "<style>" in html and "<script>\n" in html, "index.html layout changed"
(out / "index.html").write_text(html, encoding="utf-8")
shutil.copy(docs / "player" / "skin.js", out / "skin.js")
print(f"bundled site -> {out / 'index.html'} ({len(html) // 1024} KB)")
