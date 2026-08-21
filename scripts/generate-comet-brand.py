#!/usr/bin/env python3
"""Generate InvestSalsa comet-board assets from the locked shooting-star mark.

The attached comet-icon.png / comet-og.png were not mounted on disk.
This script reconstructs that mark: orange five-point star + two curved
comet tails, flat vector, #E47B31 on space navy. Do not invent a different mark.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
BRAND = PUBLIC / "brand"
STILLS = PUBLIC / "stills"
APP = ROOT / "src" / "app"

COMET = (228, 123, 49)  # #E47B31
LAVA = (216, 89, 33)  # #D85921
CORE = (240, 167, 93)  # #F0A75D
SPACE = (2, 3, 13)  # #02030D
BLACK = (1, 1, 9)  # #010109
WHITE = (255, 255, 255)
MUTED = (139, 147, 167)  # #8B93A7

INTER_BOLD = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf"
INTER_SEMI = "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf"
INTER_REG = "/usr/share/fonts/truetype/macos/Inter-Regular.ttf"


def star_points(
    cx: float,
    cy: float,
    outer: float,
    inner: float,
    rotation_deg: float,
) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    rot = math.radians(rotation_deg)
    for i in range(10):
        angle = rot + i * math.pi / 5 - math.pi / 2
        r = outer if i % 2 == 0 else inner
        pts.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    return pts


def poly_to_svg(pts: list[tuple[float, float]]) -> str:
    return " ".join(f"{x:.3f},{y:.3f}" for x, y in pts)


def tail_ribbon(
    start: tuple[float, float],
    mid: tuple[float, float],
    end: tuple[float, float],
    width_start: float,
    samples: int = 28,
) -> list[tuple[float, float]]:
    """Quadratic bezier ribbon that tapers to a point."""

    def quad(t: float) -> tuple[float, float]:
        mt = 1 - t
        x = mt * mt * start[0] + 2 * mt * t * mid[0] + t * t * end[0]
        y = mt * mt * start[1] + 2 * mt * t * mid[1] + t * t * end[1]
        return x, y

    def tangent(t: float) -> tuple[float, float]:
        # derivative of quadratic bezier
        dx = 2 * (1 - t) * (mid[0] - start[0]) + 2 * t * (end[0] - mid[0])
        dy = 2 * (1 - t) * (mid[1] - start[1]) + 2 * t * (end[1] - mid[1])
        length = math.hypot(dx, dy) or 1.0
        return dx / length, dy / length

    left: list[tuple[float, float]] = []
    right: list[tuple[float, float]] = []
    for i in range(samples):
        t = i / (samples - 1)
        x, y = quad(t)
        tx, ty = tangent(t)
        nx, ny = -ty, tx
        half = width_start * (1 - t) * 0.5
        left.append((x + nx * half, y + ny * half))
        right.append((x - nx * half, y - ny * half))
    return left + list(reversed(right))


# Mark geometry in a 64x64 viewBox — star at top-right, tails to bottom-left.
STAR = star_points(42.2, 21.4, 12.4, 5.15, 28)
TAIL_OUTER = tail_ribbon((34.8, 28.6), (18.0, 42.0), (5.2, 58.6), 3.35)
TAIL_INNER = tail_ribbon((31.4, 26.2), (16.5, 36.5), (8.8, 50.4), 2.55)


def write_mark_svg() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)
    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <path fill="#E47B31" d="M {poly_to_svg(TAIL_OUTER)} Z"/>
  <path fill="#E47B31" d="M {poly_to_svg(TAIL_INNER)} Z"/>
  <polygon fill="#E47B31" points="{poly_to_svg(STAR)}"/>
</svg>
"""
    (BRAND / "comet-mark.svg").write_text(svg)

    favicon = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#02030D"/>
  <g transform="translate(1.2 1.2) scale(0.4625)">
    <path fill="#E47B31" d="M {poly_to_svg(TAIL_OUTER)} Z"/>
    <path fill="#E47B31" d="M {poly_to_svg(TAIL_INNER)} Z"/>
    <polygon fill="#E47B31" points="{poly_to_svg(STAR)}"/>
  </g>
</svg>
"""
    (PUBLIC / "favicon.svg").write_text(favicon)


def scale_pts(
    pts: list[tuple[float, float]],
    scale: float,
    ox: float = 0,
    oy: float = 0,
) -> list[tuple[float, float]]:
    return [(x * scale + ox, y * scale + oy) for x, y in pts]


def draw_mark(
    draw: ImageDraw.ImageDraw,
    scale: float,
    ox: float,
    oy: float,
    color: tuple[int, int, int] = COMET,
) -> None:
    draw.polygon(scale_pts(TAIL_OUTER, scale, ox, oy), fill=color)
    draw.polygon(scale_pts(TAIL_INNER, scale, ox, oy), fill=color)
    draw.polygon(scale_pts(STAR, scale, ox, oy), fill=color)


def rounded_rect_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def make_icon(size: int, *, tile: bool = True) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0) if not tile else (*SPACE, 255))
    if tile:
        bg = Image.new("RGBA", (size, size), (*SPACE, 255))
        mask = rounded_rect_mask(size, max(8, size // 5))
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        canvas.paste(bg, mask=mask)
        img = canvas
    draw = ImageDraw.Draw(img)
    pad = size * (0.08 if tile else 0.02)
    usable = size - pad * 2
    scale = usable / 64
    draw_mark(draw, scale, pad, pad)
    return img


def save_icon_set() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    APP.mkdir(parents=True, exist_ok=True)

    icon_1024 = make_icon(1024, tile=True)
    icon_1024.save(BRAND / "comet-icon.png", optimize=True)
    icon_1024.resize((512, 512), Image.Resampling.LANCZOS).save(
        PUBLIC / "logo.png", optimize=True
    )
    icon_1024.resize((180, 180), Image.Resampling.LANCZOS).save(
        PUBLIC / "apple-touch-icon.png", optimize=True
    )
    icon_1024.resize((180, 180), Image.Resampling.LANCZOS).save(
        APP / "apple-icon.png", optimize=True
    )
    icon_512 = icon_1024.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512.save(APP / "icon.png", optimize=True)
    icon_1024.resize((32, 32), Image.Resampling.LANCZOS).save(
        PUBLIC / "favicon-32.png", optimize=True
    )
    icon_1024.resize((16, 16), Image.Resampling.LANCZOS).save(
        PUBLIC / "favicon-16.png", optimize=True
    )

    mark = make_icon(512, tile=False)
    mark.save(BRAND / "comet-mark.png", optimize=True)
    BRAND.joinpath("logo-icon.png").write_bytes((BRAND / "comet-mark.png").read_bytes())

    ico_sizes = [(16, 16), (32, 32), (48, 48)]
    ico_images = [icon_1024.resize(s, Image.Resampling.LANCZOS) for s in ico_sizes]
    ico_images[0].save(
        APP / "favicon.ico",
        format="ICO",
        sizes=ico_sizes,
        append_images=ico_images[1:],
    )


def sprinkle_stars(
    draw: ImageDraw.ImageDraw,
    width: int,
    height: int,
    count: int,
    rng: random.Random,
) -> None:
    for _ in range(count):
        x = rng.randint(0, width - 1)
        y = rng.randint(0, height - 1)
        brightness = rng.randint(140, 255)
        size = 1 if rng.random() < 0.82 else 2
        color = (brightness, brightness, min(255, brightness + 8), rng.randint(90, 220))
        draw.ellipse((x, y, x + size, y + size), fill=color)


def starfield(width: int, height: int, seed: int = 7) -> Image.Image:
    rng = random.Random(seed)
    img = Image.new("RGBA", (width, height), (*SPACE, 255))
    # faint blue nebula wash
    nebula = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    n = ImageDraw.Draw(nebula)
    for cx, cy, r, color, alpha in (
        (int(width * 0.18), int(height * 0.78), int(width * 0.38), (72, 40, 110), 46),
        (int(width * 0.28), int(height * 0.86), int(width * 0.28), (180, 70, 40), 28),
        (int(width * 0.72), int(height * 0.18), int(width * 0.22), (30, 50, 90), 30),
    ):
        blob = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        ImageDraw.Draw(blob).ellipse(
            (cx - r, cy - r, cx + r, cy + r),
            fill=(*color, alpha),
        )
        nebula = Image.alpha_composite(nebula, blob.filter(ImageFilter.GaussianBlur(90)))
    img = Image.alpha_composite(img, nebula)
    stars = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    sprinkle_stars(ImageDraw.Draw(stars), width, height, 420, rng)
    return Image.alpha_composite(img, stars)


def quad_point(
    start: tuple[float, float],
    mid: tuple[float, float],
    end: tuple[float, float],
    t: float,
) -> tuple[float, float]:
    mt = 1 - t
    x = mt * mt * start[0] + 2 * mt * t * mid[0] + t * t * end[0]
    y = mt * mt * start[1] + 2 * mt * t * mid[1] + t * t * end[1]
    return x, y


def long_comet_path(
    width: int, height: int
) -> tuple[tuple[float, float], tuple[float, float], tuple[float, float]]:
    """Bottom-left to upper-right luminous streak. Star sits at the head."""
    tail = (width * 0.02, height * 0.92)
    mid = (width * 0.38, height * 0.42)
    head = (width * 0.78, height * 0.18)
    return tail, mid, head


def long_comet_streak(width: int, height: int, seed: int = 9) -> Image.Image:
    """Long filament streak for hero / OG / login — not the compact two-stripe mark."""
    rng = random.Random(seed)
    tail, mid, head = long_comet_path(width, height)
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    filaments = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    fdraw = ImageDraw.Draw(filaments)
    steps = 140

    # Soft plasma body
    for i in range(steps):
        t = i / (steps - 1)
        x, y = quad_point(tail, mid, head, t)
        fade = t**1.15
        w = max(2, int((8 + 46 * fade) * (width / 1920)))
        h = max(1, int(w * 0.38))
        if t > 0.82:
            color = (*WHITE, int(70 * fade))
        elif t > 0.55:
            color = (*CORE, int(90 * fade))
        else:
            color = (*COMET, int(55 + 70 * fade))
        gdraw.ellipse((x - w, y - h, x + w, y + h), fill=color)

    # Fine luminous filaments
    for _ in range(54):
        offset = rng.uniform(-18, 18) * (width / 1920)
        jitter = rng.uniform(-10, 10) * (height / 1080)
        width_scale = rng.uniform(0.35, 1.15)
        for i in range(steps):
            t = i / (steps - 1)
            x, y = quad_point(tail, mid, head, t)
            # perpendicular nudge
            x += offset * (1 - t) * 0.65
            y += jitter * (1 - t) * 0.45 + math.sin(t * 9 + offset) * 1.6
            fade = t**1.05
            w = max(1, int((1.2 + 3.4 * fade) * width_scale))
            alpha = int((30 + 150 * fade) * rng.uniform(0.55, 1.0))
            if t > 0.88:
                color = (255, 248, 236, min(255, alpha + 40))
            elif t > 0.6:
                color = (*CORE, alpha)
            else:
                color = (*COMET, alpha)
            fdraw.ellipse((x - w, y - w * 0.45, x + w, y + w * 0.45), fill=color)

    glow = glow.filter(ImageFilter.GaussianBlur(18))
    filaments = filaments.filter(ImageFilter.GaussianBlur(1.1))
    layer = Image.alpha_composite(glow, filaments)

    # White-hot head + compact star (identity mark at the tip)
    head_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(head_layer)
    hx, hy = head
    hdraw.ellipse((hx - 28, hy - 16, hx + 28, hy + 16), fill=(255, 252, 245, 210))
    head_layer = head_layer.filter(ImageFilter.GaussianBlur(8))
    star_scale = (width * 0.042) / 64
    draw_mark(ImageDraw.Draw(head_layer), star_scale, hx - 32 * star_scale, hy - 22 * star_scale)
    return Image.alpha_composite(layer, head_layer)


def make_hero() -> Image.Image:
    width, height = 1920, 1080
    img = starfield(width, height, seed=11)
    img = Image.alpha_composite(img, long_comet_streak(width, height, seed=11))
    return img.convert("RGB")


def make_constellation() -> Image.Image:
    width, height = 1600, 1000
    img = starfield(width, height, seed=21)
    grid = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(grid)
    step = 72
    for x in range(0, width, step):
        draw.line((x, 0, x, height), fill=(40, 70, 120, 28), width=1)
    for y in range(0, height, step):
        draw.line((0, y, width, y), fill=(40, 70, 120, 28), width=1)
    nodes = [
        (220, 280),
        (420, 210),
        (610, 320),
        (780, 180),
        (1040, 300),
        (1280, 240),
        (360, 520),
        (700, 560),
        (980, 500),
        (1220, 620),
    ]
    for a, b in zip(nodes, nodes[1:]):
        draw.line((a, b), fill=(80, 110, 160, 70), width=1)
    for x, y in nodes:
        draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(220, 230, 255, 180))
    return Image.alpha_composite(img, grid).convert("RGB")


def make_plasma() -> Image.Image:
    width, height = 1600, 1000
    img = starfield(width, height, seed=31)
    burst = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(burst)
    cx, cy = int(width * 0.42), int(height * 0.52)
    for i, (r, color, alpha) in enumerate(
        (
            (420, LAVA, 40),
            (280, COMET, 70),
            (150, CORE, 90),
            (60, WHITE, 140),
        )
    ):
        draw.ellipse((cx - r, cy - int(r * 0.62), cx + r, cy + int(r * 0.62)), fill=(*color, alpha))
    # streaks
    for angle in (-28, -12, 8, 22):
        rad = math.radians(angle)
        x2 = cx + math.cos(rad) * 520
        y2 = cy + math.sin(rad) * 220
        draw.line((cx, cy, x2, y2), fill=(*COMET, 70), width=10)
    burst = burst.filter(ImageFilter.GaussianBlur(18))
    return Image.alpha_composite(img, burst).convert("RGB")


def make_nebula() -> Image.Image:
    width, height = 1600, 1000
    img = starfield(width, height, seed=41)
    cloud = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(cloud)
    for cx, cy, rx, ry, color, alpha in (
        (900, 420, 420, 160, COMET, 55),
        (720, 500, 280, 110, LAVA, 40),
        (1080, 360, 220, 80, CORE, 50),
        (500, 620, 260, 90, (90, 50, 130), 36),
    ):
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(*color, alpha))
    cloud = cloud.filter(ImageFilter.GaussianBlur(28))
    return Image.alpha_composite(img, cloud).convert("RGB")


def make_comet_still() -> Image.Image:
    width, height = 1600, 1000
    img = starfield(width, height, seed=51)
    img = Image.alpha_composite(img, long_comet_streak(width, height, seed=51))
    return img.convert("RGB")


def make_og() -> Image.Image:
    """Long-streak composition: star at upper right, lockup in the lower-right."""
    width, height = 1200, 630
    img = starfield(width, height, seed=3)
    img = Image.alpha_composite(img, long_comet_streak(width, height, seed=3))
    canvas = img.convert("RGBA")
    draw = ImageDraw.Draw(canvas)

    bold = ImageFont.truetype(INTER_BOLD, 54)
    tag = ImageFont.truetype(INTER_REG, 22)
    word = "InvestSalsa"
    tagline = "Freedom, engineered."
    tx, ty = int(width * 0.58), int(height * 0.62)
    draw.text((tx, ty), word, font=bold, fill=WHITE)
    draw.text((tx, ty + 68), tagline, font=tag, fill=WHITE)

    return canvas.convert("RGB")


def make_hero_lockup() -> Image.Image:
    """Signed-out / login composition: long streak + wordmark + tagline."""
    width, height = 1920, 1080
    img = starfield(width, height, seed=11)
    img = Image.alpha_composite(img, long_comet_streak(width, height, seed=11))
    canvas = img.convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    bold = ImageFont.truetype(INTER_BOLD, 86)
    tag = ImageFont.truetype(INTER_REG, 32)
    tx, ty = int(width * 0.58), int(height * 0.60)
    draw.text((tx, ty), "InvestSalsa", font=bold, fill=WHITE)
    draw.text((tx, ty + 102), "Freedom, engineered.", font=tag, fill=WHITE)
    return canvas.convert("RGB")


def write_stills() -> None:
    STILLS.mkdir(parents=True, exist_ok=True)
    make_hero().save(STILLS / "hero.jpg", quality=92, optimize=True)
    make_hero_lockup().save(STILLS / "hero-lockup.jpg", quality=92, optimize=True)
    make_constellation().save(STILLS / "home.jpg", quality=90, optimize=True)
    make_plasma().save(STILLS / "budget.jpg", quality=90, optimize=True)
    make_nebula().save(STILLS / "invest.jpg", quality=90, optimize=True)
    make_comet_still().save(STILLS / "freedom.jpg", quality=90, optimize=True)
    make_og().save(PUBLIC / "og.png", optimize=True)
    make_og().save(BRAND / "comet-og.png", optimize=True)


def main() -> None:
    write_mark_svg()
    save_icon_set()
    write_stills()
    print("Generated comet brand assets.")


if __name__ == "__main__":
    main()
