"""Builds the Ciname website (Cloudflare Pages at anikku.pages.dev, and GitHub Pages):

  <out>/index.html          the picker (ciname/Launcher): Anikku -> anikku/, Cinejoy -> cinejoy.pk in a new tab
  <out>/anikku/index.html   Anikku (docs/, bundled into one page by ios/bundle_web.py)

cinejoy.pk forbids being framed (X-Frame-Options: DENY), and the in-browser Scramjet proxy route failed
in Oct 2026: public Wisp relays either get their TLS handshake cut by cinejoy.pk or reject its new
Let's Encrypt chain, so the website opens Cinejoy in its own tab.

Every page opens behind the passcode screen in site/gate.html. Only the passcode's SHA-256 is kept
here (the repo is public); an unlock lasts until the page is refreshed.

usage: python3 site/build.py <out-dir>      (needs Node for esbuild, like ios/bundle_web.py)
"""
import base64
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "_site").resolve()

# sha256("ciname:" + passcode)
PASS_HASH = "9993c5b7e7731ca68dd5a940d9bf5c2959a9f6fd253ad41748121d868bcf8348"


def run(*args):
    subprocess.run([sys.executable, *map(str, args)], check=True)


def inject(page: Path, extra: str):
    html = page.read_text(encoding="utf-8")
    assert "<head>" in html, f"{page} has no <head>"
    page.write_text(html.replace("<head>", "<head>\n" + extra, 1), encoding="utf-8")


if OUT.exists():
    shutil.rmtree(OUT)
(OUT / "anikku").mkdir(parents=True)

run(ROOT / "ios" / "bundle_web.py", OUT / "anikku")
(OUT / "anikku" / "skin.js").unlink(missing_ok=True)      # the skin needs an app to inject it
run(ROOT / "ciname" / "tools" / "inline_launcher.py", OUT)
(OUT / "launcher.html").rename(OUT / "index.html")

logo = "data:image/png;base64," + base64.b64encode((ROOT / "ciname" / "Launcher" / "ciname.png").read_bytes()).decode()
gate = (ROOT / "site" / "gate.html").read_text(encoding="utf-8").replace("{{HASH}}", PASS_HASH).replace("{{LOGO}}", logo)
head = f'<script>window.CINAME_WEB = true;</script>\n<link rel="icon" type="image/png" href="{logo}">\n{gate}\n'
inject(OUT / "index.html", head)
inject(OUT / "anikku" / "index.html", head)
(OUT / ".nojekyll").write_text("")
print("website ->", OUT)
