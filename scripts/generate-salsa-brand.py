#!/usr/bin/env python3
"""Export InvestSalsa favicon, icons, OG, and stills from the locked mark.

Source of truth: public/brand/logo-dark-full.png (icon + wordmark) and
public/brand/logo-icon-dark.png (growth line + salsa swooshes).
Do not invent a different mark.
"""

from __future__ import annotations

import base64
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
BRAND = PUBLIC / "brand"
STILLS = PUBLIC / "stills"
APP = ROOT / "src" / "app"

CHARCOAL = (18, 18, 18)  # #121212
SURFACE = (26, 26, 26)  # #1A1A1A
GREEN = (100, 184, 96)  # #64B860
ORANGE = (242, 140, 51)  # #F28C33
RED = (214, 69, 42)  # #D6452A
WHITE = (245, 245, 245)
MUTED = (163, 163, 168)

INTER_BOLD = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf"
INTER_REG = "/usr/share/fonts/truetype/macos/Inter-Regular.ttf"

SOURCE_FULL = BRAND / "logo-dark-full.png"
SOURCE_ICON = BRAND / "logo-icon-dark.png"
SOURCE_STACKED = BRAND / "logo-stacked-dark.png"


def punch_dark(img: Image.Image, threshold: int = 32) -> Image.Image:
    """Make near-black charcoal pixels transparent so the mark can sit on #121212."""
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    assert pixels is not None
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if r < threshold and g < threshold and b < threshold:
                pixels[x, y] = (r, g, b, 0)
    return rgba


def trim_alpha(img: Image.Image, pad: int = 8) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(img.width, right + pad)
    bottom = min(img.height, bottom + pad)
    return img.crop((left, top, right, bottom))


def contain(img: Image.Image, box: int) -> Image.Image:
    clone = img.copy()
    clone.thumbnail((box, box), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (box, box), (0, 0, 0, 0))
    canvas.paste(clone, ((box - clone.width) // 2, (box - clone.height) // 2), clone)
    return canvas


def rounded_rect_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def tile_icon(mark: Image.Image, size: int, radius: int | None = None) -> Image.Image:
    bg = Image.new("RGBA", (size, size), (*CHARCOAL, 255))
    if radius is None:
        radius = max(8, size // 5)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(bg, mask=rounded_rect_mask(size, radius))
    fitted = contain(mark, int(size * 0.84))
    canvas.alpha_composite(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))
    return canvas


def vignette(width: int, height: int) -> Image.Image:
    img = Image.new("RGBA", (width, height), (*CHARCOAL, 255))
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    for cx, cy, rx, ry, color, alpha in (
        (int(width * 0.18), int(height * 0.18), int(width * 0.42), int(height * 0.38), GREEN, 46),
        (int(width * 0.82), int(height * 0.22), int(width * 0.36), int(height * 0.34), ORANGE, 38),
        (int(width * 0.72), int(height * 0.78), int(width * 0.28), int(height * 0.28), RED, 22),
    ):
        blob = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        ImageDraw.Draw(blob).ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(*color, alpha))
        glow = Image.alpha_composite(glow, blob.filter(ImageFilter.GaussianBlur(90)))
    return Image.alpha_composite(img, glow)


def paste_centered(base: Image.Image, overlay: Image.Image, cy_ratio: float = 0.46) -> None:
    x = (base.width - overlay.width) // 2
    y = int(base.height * cy_ratio) - overlay.height // 2
    base.alpha_composite(overlay, (max(0, x), max(0, y)))


def write_favicon_svg(mark_png: Path) -> None:
    raw = mark_png.read_bytes()
    b64 = base64.b64encode(raw).decode("ascii")
    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#121212"/>
  <image x="3" y="3" width="26" height="26" href="data:image/png;base64,{b64}" xlink:href="data:image/png;base64,{b64}"/>
</svg>
"""
    (PUBLIC / "favicon.svg").write_text(svg)


def save_icon_set(mark: Image.Image) -> None:
    BRAND.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    APP.mkdir(parents=True, exist_ok=True)

    icon_1024 = tile_icon(mark, 1024)
    icon_1024.save(BRAND / "app-icon.png", optimize=True)
    icon_1024.save(PUBLIC / "logo.png", optimize=True)
    icon_1024.resize((180, 180), Image.Resampling.LANCZOS).save(
        PUBLIC / "apple-touch-icon.png", optimize=True
    )
    icon_1024.resize((32, 32), Image.Resampling.LANCZOS).save(
        PUBLIC / "favicon-32.png", optimize=True
    )
    icon_1024.resize((16, 16), Image.Resampling.LANCZOS).save(
        PUBLIC / "favicon-16.png", optimize=True
    )

    transparent = contain(mark, 512)
    transparent.save(BRAND / "logo-icon.png", optimize=True)

    stacked_lockup = trim_alpha(punch_dark(Image.open(SOURCE_STACKED if SOURCE_STACKED.exists() else SOURCE_FULL)), pad=4)
    stacked_lockup.save(BRAND / "logo-lockup.png", optimize=True)

    # Replace leftover comet/lime marks with the salsa icon on charcoal.
    icon_1024.save(BRAND / "comet-icon.png", optimize=True)
    tile_icon(mark, 512).save(BRAND / "comet-mark.png", optimize=True)

    fav_tile = tile_icon(mark, 64, radius=16)
    fav_tile.save(BRAND / "favicon-mark.png", optimize=True)
    write_favicon_svg(BRAND / "favicon-mark.png")

    ico_sizes = [(16, 16), (32, 32), (48, 48)]
    ico_images = [icon_1024.resize(s, Image.Resampling.LANCZOS) for s in ico_sizes]
    ico_images[0].save(
        APP / "favicon.ico",
        format="ICO",
        sizes=ico_sizes,
        append_images=ico_images[1:],
    )


def stack_on_vignette(
    stacked: Image.Image,
    width: int,
    height: int,
    scale: float,
    cy_ratio: float,
    tagline: str | None = None,
) -> Image.Image:
    canvas = vignette(width, height)
    fitted_w = int(width * scale)
    ratio = stacked.height / stacked.width
    fitted = stacked.resize((fitted_w, max(1, int(fitted_w * ratio))), Image.Resampling.LANCZOS)
    paste_centered(canvas, fitted, cy_ratio=cy_ratio)

    if tagline:
        draw = ImageDraw.Draw(canvas)
        font = ImageFont.truetype(INTER_REG, max(18, int(height * 0.036)))
        bbox = draw.textbbox((0, 0), tagline, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        tx = (width - tw) // 2
        ty = int(height * 0.78)
        draw.text((tx, ty), tagline, font=font, fill=MUTED)
        del th

    return canvas.convert("RGB")


def write_wordmark_from_stacked(stacked: Image.Image) -> None:
    """Keep a dark wordmark board — the stacked mark already includes the gradient."""
    # Crop the lower wordmark band if the stacked asset includes icon + text.
    band = stacked.crop((0, int(stacked.height * 0.62), stacked.width, stacked.height))
    band = punch_dark(band)
    band = trim_alpha(band, pad=4)
    if band.width < 40:
        return
    canvas = Image.new("RGBA", (max(530, band.width + 40), 120), (*CHARCOAL, 255))
    fitted_h = 72
    ratio = band.width / band.height
    fitted = band.resize((int(fitted_h * ratio), fitted_h), Image.Resampling.LANCZOS)
    canvas.alpha_composite(
        fitted,
        ((canvas.width - fitted.width) // 2, (canvas.height - fitted.height) // 2),
    )
    canvas.convert("RGB").save(BRAND / "wordmark.png", optimize=True)


def write_stills(stacked: Image.Image) -> None:
    STILLS.mkdir(parents=True, exist_ok=True)

    hero = stack_on_vignette(stacked, 1920, 1080, scale=0.36, cy_ratio=0.42)
    hero.save(STILLS / "hero.jpg", quality=92, optimize=True)

    lockup = stack_on_vignette(
        stacked,
        1920,
        1080,
        scale=0.34,
        cy_ratio=0.40,
        tagline="Freedom, engineered.",
    )
    lockup.save(STILLS / "hero-lockup.jpg", quality=92, optimize=True)

    for name, seed_shift in (
        ("home", 0.16),
        ("budget", 0.20),
        ("invest", 0.14),
        ("freedom", 0.18),
    ):
        still = vignette(1600, 1000)
        # Quiet mark — present, not a competing wordmark.
        fitted_w = int(1600 * seed_shift)
        ratio = stacked.height / stacked.width
        fitted = stacked.resize((fitted_w, max(1, int(fitted_w * ratio))), Image.Resampling.LANCZOS)
        faded = fitted.copy()
        faded.putalpha(ImageEnhance.Brightness(fitted.split()[-1]).enhance(0.55))
        paste_centered(still, faded, cy_ratio=0.48)
        still.convert("RGB").save(STILLS / f"{name}.jpg", quality=90, optimize=True)

    og = stack_on_vignette(
        stacked,
        1200,
        630,
        scale=0.46,
        cy_ratio=0.42,
        tagline="Freedom, engineered.",
    )
    og.save(PUBLIC / "og.png", optimize=True)
    og.save(BRAND / "comet-og.png", optimize=True)


def write_mark_svg_placeholder(mark: Image.Image) -> None:
    """Keep comet-mark.svg from serving the old shooting-star: embed the salsa icon."""
    tile = contain(mark, 256)
    raw = tile.tobytes("raw")  # keep type checkers quiet
    del raw
    buf_path = BRAND / "logo-icon.png"
    b64 = base64.b64encode(buf_path.read_bytes()).decode("ascii")
    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64" fill="none">
  <image x="2" y="2" width="60" height="60" href="data:image/png;base64,{b64}" xlink:href="data:image/png;base64,{b64}"/>
</svg>
"""
    (BRAND / "comet-mark.svg").write_text(svg)


def main() -> None:
    if not SOURCE_ICON.exists() or not SOURCE_FULL.exists():
        raise SystemExit("Locked salsa mark files are missing from public/brand.")

    icon = trim_alpha(punch_dark(Image.open(SOURCE_ICON)), pad=6)
    stacked_src = SOURCE_STACKED if SOURCE_STACKED.exists() else SOURCE_FULL
    stacked = punch_dark(Image.open(stacked_src))
    stacked = trim_alpha(stacked, pad=4)

    # Canonical copies of the attached board.
    Image.open(SOURCE_FULL).convert("RGB").save(BRAND / "investsalsa-logo.png", optimize=True)

    save_icon_set(icon)
    write_mark_svg_placeholder(icon)
    write_wordmark_from_stacked(stacked)
    write_stills(stacked)
    print("Generated salsa brand assets from the locked mark.")


if __name__ == "__main__":
    main()
