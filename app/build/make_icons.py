#!/usr/bin/env python3
"""Renders app/build/assets/icon.svg to the PNG icons in docs/ (macOS only: uses Quick Look and sips).

  python3 app/build/make_icons.py
"""
import shutil, subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SVG = ROOT / "app" / "build" / "assets" / "icon.svg"
OUT = ROOT / "docs"

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(["qlmanage", "-t", "-s", "1024", "-o", tmp, str(SVG)], check=True, capture_output=True)
    big = Path(tmp) / (SVG.name + ".png")
    assert big.exists(), "Quick Look did not render the SVG"
    for size in (512, 192, 180):
        dest = OUT / f"icon-{size}.png"
        subprocess.run(["sips", "-z", str(size), str(size), str(big), "--out", str(dest)], check=True, capture_output=True)
        print("wrote", dest.relative_to(ROOT))
