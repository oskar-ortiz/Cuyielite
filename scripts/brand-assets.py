"""Compile native/browser assets from the existing Ionicons paw mark (MIT).

Run render-brand.cjs with Electron first, then this file with Python + Pillow.
Generated assets are committed; neither tool is a runtime dependency.
"""
from pathlib import Path
import shutil
import xml.etree.ElementTree as ET

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CLIENT = ROOT / "client"
RES = CLIENT / "android/app/src/main/res"
image = Image.open(CLIENT / "resources/brand.png").convert("RGBA")
for density, size in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    for name in ("ic_launcher.png", "ic_launcher_round.png"):
        image.resize((size, size), Image.Resampling.LANCZOS).save(RES / f"mipmap-{density}" / name)
image.save(CLIENT / "electron/assets/icon.ico", sizes=[(n, n) for n in (16, 24, 32, 48, 64, 128, 256)])
shutil.copy2(CLIENT / "resources/brand.png", CLIENT / "electron/assets/icon.png")
image.resize((64, 64), Image.Resampling.LANCZOS).save(CLIENT / "public/favicon.png")
shutil.copy2(CLIENT / "resources/brand.png", CLIENT / "public/icon-512.png")
path = ET.parse(CLIENT / "resources/brand.svg").getroot().find(".//{http://www.w3.org/2000/svg}path").attrib["d"]
paw = f'<group android:translateX="96" android:translateY="96" android:scaleX="0.625" android:scaleY="0.625"><path android:pathData="{path}" android:fillColor="@android:color/transparent" android:strokeColor="#FFFFFF" android:strokeWidth="32"/></group>'
base = '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="512" android:viewportHeight="512">'
(RES / "drawable/brand_foreground.xml").write_text(base + paw + '</vector>\n', encoding="utf-8")
(RES / "drawable/brand_mark.xml").write_text(base + '<path android:fillColor="#1D4ED8" android:pathData="M96,0 H416 Q512,0 512,96 V416 Q512,512 416,512 H96 Q0,512 0,416 V96 Q0,0 96,0 Z"/>' + paw + '</vector>\n', encoding="utf-8")
for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
    target = RES / "mipmap-anydpi-v26" / name
    target.write_text(target.read_text(encoding="utf-8").replace('@mipmap/ic_launcher_foreground', '@drawable/brand_foreground'), encoding="utf-8")
(RES / "values/ic_launcher_background.xml").write_text('<resources><color name="ic_launcher_background">#1D4ED8</color></resources>\n', encoding="utf-8")
(RES / "drawable/brand_splash.xml").write_text('''<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@android:color/white"/>
  <item android:drawable="@drawable/brand_mark" android:gravity="center" android:width="160dp" android:height="160dp"/>
</layer-list>
''', encoding="utf-8")
print("CuyiElite: iconos Android, Windows y navegador generados.")
