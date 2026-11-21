"""Rebuild local PNG/ICO assets from Verona's original generated logo master."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def main():
    source = ROOT / "docs" / "branding" / "verona-master.png"
    with Image.open(source) as image:
        image.load()
        if image.width != image.height or image.width < 512:
            raise ValueError("The original logo must be square and at least 512 pixels.")
        image = image.convert("RGB")
        for size, name in ((512, "verona-logo.png"), (32, "favicon-32.png")):
            image.resize((size, size), Image.Resampling.LANCZOS).save(
                ROOT / "verona" / "web" / name, optimize=True)
        image.resize((256, 256), Image.Resampling.LANCZOS).save(
            ROOT / "verona" / "web" / "verona.ico",
            sizes=[(size, size) for size in (16, 24, 32, 48, 64, 128, 256)])


if __name__ == "__main__":
    main()
