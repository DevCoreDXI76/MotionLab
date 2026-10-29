"""Spike A — Cloudflare Workers AI (free 10,000 neurons/day) image generation.

Experimental only; not part of the pipeline (scripts/). Usage:
  py generate.py --verify         # check token only (0 neurons)
  py generate.py --run            # generate every PLAN entry not yet in manifest.json

Credentials are read from secrets/cloudflare_ai.txt (ACCOUNT_ID=..., API_TOKEN=...)
and never printed or written anywhere. Free plan only: on quota exhaustion the API
errors out; this script also stops itself at 80% of the daily allocation.

Neuron prices (developers.cloudflare.com/workers-ai/platform/pricing, 2026-10-29):
  flux-1-schnell   4.80/512² tile + 9.60/step
  flux-2-klein-4b  26.05/output 512² tile (+5.37/input tile; steps fixed at 4)
Tiles are counted conservatively as ceil(w/512)*ceil(h/512).
"""
import argparse
import base64
import json
import math
import sys
import time
import traceback
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
CRED_FILE = REPO / "secrets" / "cloudflare_ai.txt"
MANIFEST = HERE / "manifest.json"
ERROR_LOG = HERE / "errors.log"
LOG_MD = HERE.parents[1] / "log.md"
API = "https://api.cloudflare.com/client/v4"

SCHNELL = "@cf/black-forest-labs/flux-1-schnell"
KLEIN = "@cf/black-forest-labs/flux-2-klein-4b"
SCHNELL_STEPS = 8  # schema max; default is 4
DAILY_FREE = 10_000
STOP_RATIO = 0.8

SEED_A = 20261029
SEED_B = 777

TONE = (", dark workspace at night, lit only by cool blue monitor glow, shallow depth of field, "
        "35mm film photo, only hands visible, cropped at the wrists, no people in frame")

# repro_* = 007 Pexels queries verbatim (from *.credit.json); tone_* = 1기 tone variants.
PLAN = [
    {"id": "repro_s1", "scene": "007 scene-1-title", "prompt": "hands typing on laptop keyboard close up", "seed": SEED_A},
    {"id": "repro_s2", "scene": "007 scene-2-problem", "prompt": "hands scrolling code on laptop screen close up", "seed": SEED_A},
    {"id": "repro_s4", "scene": "007 scene-4-fix", "prompt": "programmer hands close up screen editing", "seed": SEED_A},
    {"id": "repro_s5", "scene": "007 scene-5-meaning", "prompt": "hands closing laptop screen close up", "seed": SEED_A},
    {"id": "tone_s1", "scene": "007 scene-1-title", "prompt": "Close-up of hands typing on a laptop keyboard" + TONE, "seed": SEED_A},
    {"id": "tone_s1_seedB", "scene": "007 scene-1-title", "prompt": "Close-up of hands typing on a laptop keyboard" + TONE, "seed": SEED_B},
    {"id": "tone_s2", "scene": "007 scene-2-problem", "prompt": "Close-up of a hand scrolling a trackpad, laptop screen full of code in soft focus" + TONE, "seed": SEED_A},
    {"id": "tone_s4", "scene": "007 scene-4-fix", "prompt": "Over-the-shoulder close-up of a laptop screen showing a code editor, fingers on the keyboard" + TONE, "seed": SEED_A},
    {"id": "tone_s5", "scene": "007 scene-5-meaning", "prompt": "Close-up of hands gently closing a laptop lid" + TONE, "seed": SEED_A},
]
# FLUX.2 comparison: same prompt/seed as tone_s1, generated natively at 1080x1920.
PLAN += [{**PLAN[4], "id": "klein_tone_s1", "model": KLEIN, "size": [1080, 1920]}]

# klein reinforcement (2026-10-29): remaining prompts; screen-bearing ones get a focus suffix so
# fake glyphs stay unreadable. tone_s1 seed B keeps klein_tone_s1's exact prompt for a clean seed test.
FOCUS = ", screen out of focus, shallow depth of field"
PLAN += [{**p, "id": f"klein_{p['id']}", "model": KLEIN, "size": [1072, 1920],
          "prompt": p["prompt"] + (FOCUS if "screen" in p["prompt"] else "")}
         for p in PLAN if p["id"] in ("repro_s1", "repro_s2", "repro_s4", "repro_s5", "tone_s2", "tone_s4", "tone_s5")]
PLAN += [{**PLAN[4], "id": "klein_tone_s1_seedB", "model": KLEIN, "size": [1072, 1920], "seed": SEED_B}]


def log_error(msg: str) -> None:
    with ERROR_LOG.open("a", encoding="utf-8") as f:
        f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")


def load_creds() -> dict:
    if not CRED_FILE.exists():
        sys.exit("secrets/cloudflare_ai.txt not found")
    creds = {}
    for line in CRED_FILE.read_text(encoding="utf-8-sig").splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            creds[k.strip()] = v.strip()
    return creds


def request(creds: dict, url: str, data: bytes | None = None, ctype: str = "application/json",
            timeout: int = 180) -> dict:
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("Authorization", f"Bearer {creds['API_TOKEN']}")
    if data:
        req.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode(errors='replace')[:500]}") from None


def multipart(fields: dict) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n' for k, v in fields.items()]
    return ("".join(parts) + f"--{boundary}--\r\n").encode(), f"multipart/form-data; boundary={boundary}"


def tiles(w: int, h: int) -> int:
    return math.ceil(w / 512) * math.ceil(h / 512)


def neurons(model: str, w: int, h: int) -> float:
    if model == KLEIN:
        return round(tiles(w, h) * 26.05, 1)
    return round(tiles(w, h) * 4.80 + SCHNELL_STEPS * 9.60, 1)


def load_manifest() -> list:
    return json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else []


def used_today(manifest: list) -> float:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return sum(m.get("neurons_est", 0) for m in manifest if m.get("generated_at_utc", "").startswith(today))


def append_log(row: str) -> None:
    text = LOG_MD.read_text(encoding="utf-8")
    header = "## Neuron 누적 (Cloudflare Workers AI 무료, 하루 10,000 / 80% 8,000에서 자동 중단)"
    if header not in text:
        text = text.replace("## 2단계 백로그", f"{header}\n| 일시(UTC) | 실험 | 내역 | 추정 neurons | 오늘 누적 |\n|---|---|---|---|---|\n\n## 2단계 백로그")
    marker = "\n\n## 2단계 백로그"
    text = text.replace(marker, f"\n{row}{marker}", 1)
    LOG_MD.write_text(text, encoding="utf-8")


def to_1080x1920(src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    target = 1080 / 1920
    if w / h > target:  # too wide → crop sides
        nw = round(h * target)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:  # too tall → crop top/bottom
        nh = round(w / target)
        im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    im.resize((1080, 1920), Image.LANCZOS).save(dst, quality=92)


def generate(creds: dict, item: dict) -> tuple[bytes, dict]:
    model = item.get("model", SCHNELL)
    url = f"{API}/accounts/{creds['ACCOUNT_ID']}/ai/run/{model}"
    if model == KLEIN:
        w, h = item["size"]
        data, ctype = multipart({"prompt": item["prompt"], "width": w, "height": h, "seed": item["seed"]})
        params = {"width": w, "height": h, "steps": 4}
    else:
        # schema has additionalProperties:false and rejects seed (HTTP 400 5006), despite the doc example
        body = {"prompt": item["prompt"], "steps": SCHNELL_STEPS}
        data, ctype = json.dumps(body).encode(), "application/json"
        params = {"steps": SCHNELL_STEPS, "seed": None}
    res = request(creds, url, data, ctype)
    return base64.b64decode(res["result"]["image"]), params


def run(creds: dict, limit: int | None) -> None:
    manifest = load_manifest()
    done = {m["id"] for m in manifest}
    budget = DAILY_FREE * STOP_RATIO
    count = 0
    for item in PLAN:
        if item["id"] in done:
            continue
        if limit is not None and count >= limit:
            break
        model = item.get("model", SCHNELL)
        est_w, est_h = item.get("size", [1024, 1024])
        today = used_today(manifest)
        if today + neurons(model, est_w, est_h) > budget:
            print(f"neuron stop: today ~{today} + next would exceed {budget}")
            break
        count += 1
        t0 = time.time()
        try:
            img_bytes, params = generate(creds, item)
        except Exception as e:  # noqa: BLE001 — spike: record and continue
            log_error(f"{item['id']}: {type(e).__name__}: {e}\n{traceback.format_exc()}")
            print(f"{item['id']}: FAILED (see errors.log)")
            continue
        elapsed = round(time.time() - t0, 1)
        orig = HERE / "raw" / f"{item['id']}.jpg"
        orig.parent.mkdir(exist_ok=True)
        orig.write_bytes(img_bytes)
        w, h = Image.open(orig).size
        est = neurons(model, w, h)
        out = HERE / f"{item['id']}_1080x1920.jpg"
        to_1080x1920(orig, out)
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        manifest.append({
            **{k: v for k, v in item.items() if k != "size"}, "model": model, **params,
            "orig_size": [w, h], "orig_file": f"raw/{orig.name}", "file": out.name,
            "upscaled": w < 1080 or h < 1920, "elapsed_s": elapsed,
            "neurons_est": est, "cost_usd": 0, "cost_krw": 0, "generated_at_utc": now,
            "review": {"face_visible": None, "finger_distortion": None, "keyboard_distortion": None, "note": ""},
        })
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        total = round(used_today(manifest), 1)
        append_log(f"| {now} | A | {item['id']} ({model.split('/')[-1]}, {w}x{h}) | {est} | {total} |")
        print(f"{item['id']}: {w}x{h} {elapsed}s ~{est} neurons (today ~{total})")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verify", action="store_true")
    ap.add_argument("--run", action="store_true")
    ap.add_argument("--limit", type=int, help="generate at most N images this run")
    a = ap.parse_args()
    creds = load_creds()
    try:
        if a.verify:
            # account-owned (cfat_) tokens verify under /accounts/, not /user/
            res = request(creds, f"{API}/accounts/{creds['ACCOUNT_ID']}/tokens/verify")
            print("token status:", res.get("result", {}).get("status"), "success:", res.get("success"))
        elif a.run:
            run(creds, a.limit)
    except Exception as e:  # noqa: BLE001
        log_error(f"{type(e).__name__}: {e}\n{traceback.format_exc()}")
        raise


if __name__ == "__main__":
    main()
