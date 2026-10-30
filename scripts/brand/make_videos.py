"""Render the fictional "Gus in the Community" mascot-mishap clips (silent MP4 + poster + WebVTT captions).

Deterministic: python3 scripts/brand/make_videos.py apps/web/public/videos
Requires ffmpeg, Pillow, numpy, PyMuPDF (for rasterizing the Gus SVG poses).
"""
import math
import subprocess
import sys
from pathlib import Path

import fitz
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
W, H, FPS, SECONDS = 960, 540, 24, 9
NAVY, TEAL, IVORY, AMBER, SLATE = (23, 43, 58), (22, 143, 136), (248, 245, 236), (231, 166, 59), (83, 97, 106)
FONT = ROOT / "generator/fonts/Inter-Bold.ttf"
SERIF = ROOT / "generator/fonts/SourceSerif4-Bold.ttf"

EPISODES = [
    dict(slug="story-time", title="Library Story Time", banner="STORY TIME WITH GUS!", scene="library",
         caption_in="Gus arrives to read a picture book to the children.",
         caption_honk="Gus honks at full volume. Story time is over.",
         caption_run="Everyone sprints for the exits. One child is still holding the book.",
         people=[(250, (231, 120, 120)), (360, (120, 170, 231)), (470, (240, 200, 90)), (580, (150, 200, 140)), (690, (190, 140, 210))]),
    dict(slug="first-pitch", title="Little League Ceremonial First Pitch", banner="PLAY BALL!", scene="ballpark",
         caption_in="Gus waddles to the mound to throw the ceremonial first pitch.",
         caption_honk="Gus winds up, forgets the ball, and squawks instead.",
         caption_run="Both teams, the umpire, and the hot-dog vendor leave the field.",
         people=[(300, (220, 90, 80)), (420, (80, 120, 200)), (540, (220, 90, 80)), (660, (80, 120, 200))]),
    dict(slug="ribbon-cutting", title="Farmers Market Ribbon Cutting", banner="GRAND OPENING", scene="market",
         caption_in="Gus is handed oversized scissors for the ribbon cutting.",
         caption_honk="Gus flaps, honks, and eats the ribbon.",
         caption_run="Shoppers abandon their tomatoes and flee. The scissors are fine.",
         people=[(280, (200, 120, 90)), (390, (110, 160, 120)), (500, (210, 170, 80)), (610, (130, 130, 200)), (720, (200, 110, 160))]),
]


def gus_sprite(pose, height):
    svg = fitz.open(ROOT / f"apps/web/public/brand/gus-{pose}-light.svg")
    pdf = fitz.open("pdf", svg.convert_to_pdf())
    page = pdf[0]
    zoom = height / page.rect.height
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=True)
    return Image.frombytes("RGBA", (pix.width, pix.height), pix.samples)


def scene(d: ImageDraw.ImageDraw, kind, banner, font_b):
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip((205, 230, 238), IVORY)))
    d.rectangle([0, 400, W, H], fill=(150, 190, 120) if kind != "library" else (196, 160, 120))
    if kind == "library":
        for i, x in enumerate(range(40, W, 150)):
            d.rectangle([x, 120, x + 120, 400], fill=(120, 80, 50))
            for row in range(4):
                for b in range(6):
                    c = [(200, 80, 70), (70, 120, 180), (230, 180, 70), (90, 150, 100)][(b + row + i) % 4]
                    d.rectangle([x + 6 + b * 19, 130 + row * 66, x + 20 + b * 19, 180 + row * 66], fill=c)
    elif kind == "ballpark":
        d.polygon([(W // 2, 300), (W // 2 + 220, 400), (W // 2, 500), (W // 2 - 220, 400)], fill=(200, 160, 110))
        d.rectangle([0, 230, W, 300], fill=(30, 90, 60))
        for x in range(0, W, 40):
            d.line([(x, 230), (x, 300)], fill=(40, 110, 75), width=2)
    else:
        for i, x in enumerate(range(30, W, 230)):
            col = [(200, 70, 70), (22, 143, 136), (231, 166, 59), (90, 110, 190)][i % 4]
            d.rectangle([x, 250, x + 190, 400], fill=(240, 230, 210))
            for s in range(0, 190, 38):
                d.rectangle([x + s, 220, x + s + 19, 260], fill=col)
                d.rectangle([x + s + 19, 220, x + s + 38, 260], fill=(255, 255, 255))
            for k in range(5):
                d.ellipse([x + 15 + k * 34, 360, x + 40 + k * 34, 385], fill=(210, 60, 50) if i % 2 else (240, 170, 40))
    d.rectangle([W // 2 - 230, 40, W // 2 + 230, 95], fill=NAVY)
    tw = d.textlength(banner, font=font_b)
    d.text((W / 2 - tw / 2, 50), banner, font=font_b, fill=IVORY)


def person(d, x, color, t_run, scared, frame):
    base = 410
    run = t_run > 0
    bob = math.sin(frame * 0.9) * 4 if run else 0
    hx, hy = x, base - 120 + bob
    d.ellipse([hx - 18, hy - 18, hx + 18, hy + 18], fill=(240, 205, 170), outline=NAVY, width=2)
    if scared:
        d.ellipse([hx - 8, hy - 6, hx - 2, hy + 2], fill=(255, 255, 255), outline=NAVY)
        d.ellipse([hx + 2, hy - 6, hx + 8, hy + 2], fill=(255, 255, 255), outline=NAVY)
        d.ellipse([hx - 5, hy + 6, hx + 5, hy + 14], fill=NAVY)
    else:
        d.arc([hx - 8, hy, hx + 8, hy + 10], 20, 160, fill=NAVY, width=2)
        d.point([(hx - 6, hy - 3), (hx + 6, hy - 3)], fill=NAVY)
    d.rounded_rectangle([x - 20, base - 100 + bob, x + 20, base - 40 + bob], 10, fill=color, outline=NAVY, width=2)
    swing = math.sin(frame * 0.9) * 22 if run else 0
    d.line([(x - 8, base - 42 + bob), (x - 8 - swing, base)], fill=NAVY, width=6)
    d.line([(x + 8, base - 42 + bob), (x + 8 + swing, base)], fill=NAVY, width=6)
    if scared:
        d.line([(x - 18, base - 92 + bob), (x - 38, base - 140 + bob)], fill=NAVY, width=5)
        d.line([(x + 18, base - 92 + bob), (x + 38, base - 140 + bob)], fill=NAVY, width=5)
    else:
        d.line([(x - 18, base - 90), (x - 30, base - 55)], fill=NAVY, width=5)
        d.line([(x + 18, base - 90), (x + 30, base - 55)], fill=NAVY, width=5)
    if run:
        for k in range(3):
            d.line([(x - 50 - k * 14, base - 100 + k * 22), (x - 30 - k * 14, base - 100 + k * 22)], fill=SLATE, width=3)


def render(ep, outdir: Path, ep_no: int):
    font_b = ImageFont.truetype(str(FONT), 30)
    font_s = ImageFont.truetype(str(FONT), 18)
    font_honk = ImageFont.truetype(str(FONT), 92)
    font_title = ImageFont.truetype(str(SERIF), 46)
    sprites = {p: gus_sprite(p, 300) for p in ("idle", "flap", "honk", "alarmed", "celebrate", "sideeye")}
    total = FPS * SECONDS
    out = outdir / f"gus-{ep['slug']}.mp4"
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24",
                           "-preset", "medium", "-movflags", "+faststart", "-fflags", "+bitexact",
                           "-flags:v", "+bitexact", str(out)], stdin=subprocess.PIPE)
    poster = None
    for f in range(total):
        t = f / FPS
        img = Image.new("RGB", (W, H))
        d = ImageDraw.Draw(img)
        scene(d, ep["scene"], ep["banner"], font_b)
        scared = t >= 4.2
        for i, (x0, color) in enumerate(ep["people"]):
            t_run = max(0.0, t - 4.8 - i * 0.08)
            x = x0 + (t_run ** 1.6) * 260
            if x < W + 80:
                person(d, x, color, t_run, scared, f + i * 3)
                if scared and t < 6.5 and i % 2 == 0:
                    d.text((x - 30, 205 - (i % 3) * 10), "AAAH!", font=font_s, fill=(200, 40, 40))
        if t < 2:
            gx, pose = -320, "idle"
        elif t < 3.8:
            gx, pose = -320 + (t - 2) / 1.8 * 330, "flap" if int(t * 6) % 2 else "idle"
        elif t < 5.6:
            gx, pose = 10 + math.sin(t * 40) * 6, "honk"
        elif t < 7.5:
            gx, pose = 10, "celebrate" if int(t * 3) % 2 else "sideeye"
        else:
            gx, pose = 10, "sideeye"
        sp = sprites[pose]
        img.paste(sp, (int(gx), 420 - sp.height + 40), sp)
        if 3.8 <= t < 5.6:
            scale = 1 + 0.08 * math.sin(t * 30)
            d.text((300, 120 - 10 * scale), "HONK!", font=font_honk, fill=AMBER, stroke_width=4, stroke_fill=NAVY)
        d.rectangle([0, 0, W, 30], fill=NAVY)
        d.text((14, 5), f"GUS IN THE COMMUNITY \u00b7 EP. {ep_no} \u00b7 {ep['title'].upper()}", font=font_s, fill=IVORY)
        d.rectangle([0, H - 28, W, H], fill=(0, 0, 0))
        d.text((14, H - 25), "Staged comedy with a fictional mascot. Nobody was hurt. Not insurance advice.", font=font_s,
               fill=(230, 230, 230))
        if t >= 7.6:
            a = min(1.0, (t - 7.6) / 0.5)
            card = Image.new("RGB", (W, H), NAVY)
            cd = ImageDraw.Draw(card)
            cd.text((70, 170), "Gus in the Community", font=font_title, fill=IVORY)
            cd.text((70, 240), f"Episode {ep_no}: {ep['title']}", font=font_b, fill=AMBER)
            cd.text((70, 300), "Gus has been asked to stay in the parking lot next time.", font=font_s, fill=IVORY)
            cd.text((70, 330), "Staged, fictional, and no humans or geese were harmed.", font=font_s, fill=IVORY)
            img = Image.blend(img, card, a)
        if abs(t - 4.6) < 1e-6 or (poster is None and t >= 4.6):
            poster = img.copy()
        ff.stdin.write(np.asarray(img, dtype=np.uint8).tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError(f"ffmpeg failed for {out}")
    poster.save(outdir / f"gus-{ep['slug']}.jpg", quality=85)
    vtt = ["WEBVTT", "", "00:00:00.000 --> 00:00:02.000", f"[{ep['title']}. Silent clip.]", "",
           "00:00:02.000 --> 00:00:03.800", ep["caption_in"], "", "00:00:03.800 --> 00:00:05.600", ep["caption_honk"], "",
           "00:00:05.600 --> 00:00:07.600", ep["caption_run"], "", "00:00:07.600 --> 00:00:09.000",
           "Gus has been asked to stay in the parking lot next time.", ""]
    (outdir / f"gus-{ep['slug']}.vtt").write_text("\n".join(vtt))


if __name__ == "__main__":
    outdir = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "apps/web/public/videos")
    outdir.mkdir(parents=True, exist_ok=True)
    for i, ep in enumerate(EPISODES, 1):
        render(ep, outdir, i)
        print("wrote", outdir / f"gus-{ep['slug']}.mp4")
