"""Rebuild transparent icons and README lockups from Verona's branding sources."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]


def load_master(source):
    with Image.open(source) as image:
        image.load()
        if image.width != image.height or image.width < 512:
            raise ValueError("The logo master must be square and at least 512 pixels.")
        image = image.convert("RGBA")
        alpha = image.getchannel("A")
        if alpha.getextrema() != (0, 255) or alpha.getbbox() is None:
            raise ValueError("The logo master needs real transparency and visible artwork.")
        if any(alpha.getpixel(point) for point in
               ((0, 0), (0, image.height - 1), (image.width - 1, 0),
                (image.width - 1, image.height - 1))):
            raise ValueError("The logo master must have transparent corners.")
        return image


def lockup(image, font_path, dark):
    canvas = Image.new("RGBA", (1800, 600))
    head = ImageOps.contain(image, (600, 600), Image.Resampling.LANCZOS)
    canvas.alpha_composite(head, (0, (600 - head.height) // 2))
    font = ImageFont.truetype(str(font_path), 242)
    bounds = font.getbbox("Verona")
    x, y = 615, 245 - (bounds[3] - bounds[1]) // 2 - bounds[1]
    if x + bounds[2] > canvas.width - 45:
        raise ValueError("The wordmark exceeds its safe width.")
    mask = Image.new("L", canvas.size)
    ImageDraw.Draw(mask).text((x, y), "Verona", font=font, fill=255)
    start, end = ((100, 231, 239), (185, 143, 255)) if dark else ((8, 107, 131), (111, 44, 168))
    gradient = Image.new("RGBA", (canvas.width, 1))
    gradient.putdata([
        tuple(round(a + (b - a) * max(0, min(1, (column - x) / bounds[2])))
              for a, b in zip(start, end)) + (255,)
        for column in range(canvas.width)])
    gradient = gradient.resize(canvas.size)
    gradient.putalpha(mask)
    canvas = Image.alpha_composite(canvas, gradient)
    draw = ImageDraw.Draw(canvas)
    accent = (172, 137, 255) if dark else (111, 44, 168)
    draw.line([(619, 388), (634, 388), (644, 372), (655, 406),
               (668, 361), (681, 414), (694, 377), (705, 388), (723, 388)],
              fill=accent, width=5, joint="curve")
    small = ImageFont.truetype(str(font_path), 34)
    color = (173, 186, 210) if dark else (78, 82, 106)
    cursor = 755
    for character in "LOCAL VOICE. LIVING FACES.":
        draw.text((cursor, 367), character, font=small, fill=color)
        cursor += small.getlength(character) + 2
    return canvas


def main():
    branding = ROOT / "docs" / "branding"
    image = load_master(branding / "verona-master.png")
    for size, name in ((512, "verona-logo.png"), (32, "favicon-32.png")):
        image.resize((size, size), Image.Resampling.LANCZOS).save(
            ROOT / "verona" / "web" / name, optimize=True)
    image.resize((256, 256), Image.Resampling.LANCZOS).save(
        ROOT / "verona" / "web" / "verona.ico",
        sizes=[(size, size) for size in (16, 24, 32, 48, 64, 128, 256)])
    for theme in ("light", "dark"):
        lockup(image, branding / "fonts" / "Audiowide-Regular.ttf",
               dark=theme == "dark").save(branding / f"verona-lockup-{theme}.png", optimize=True)


if __name__ == "__main__":
    main()
