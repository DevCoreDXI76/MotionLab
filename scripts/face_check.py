"""Face check for AI-generated candidate images (docs/2단계_설계.md D2, pixel-rule judge).

Counts faces with OpenCV's bundled Haar cascades (frontal + profile, profile also mirrored).
Prints one JSON object {"<path>": <face count>, ...} to stdout. Exit 1 on any failure, with the
traceback appended to logs/face_check_errors.log — the caller treats a failure as a rejection.

Usage: py scripts/face_check.py <image> [<image> ...]
"""
import json
import sys
import traceback
from datetime import datetime
from pathlib import Path

LOG_FILE = Path(__file__).resolve().parent.parent / "logs" / "face_check_errors.log"
WIDTH = 540  # detection on a downscaled copy: faster, and stray texture rarely survives as a "face"
MIN_FACE = 48
# 8 (not 6): at 6 the frontal cascade fired on 2 of the 9 face-free klein spike images; at 8 it
# fires on none and still finds the visible faces in 004's Pexels b-roll. Faces covered by hands
# are missed — a known limit of this check (docs/2단계_설계.md D2 result).
MIN_NEIGHBORS = 8


def count_faces(cv2, cascades, image_path: str) -> int:
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError(f"cannot read image: {image_path}")
    scale = WIDTH / img.shape[1]
    img = cv2.equalizeHist(cv2.resize(img, (WIDTH, round(img.shape[0] * scale))))
    total = 0
    for cascade in cascades:
        for candidate in (img, cv2.flip(img, 1)):
            faces = cascade.detectMultiScale(candidate, scaleFactor=1.1, minNeighbors=MIN_NEIGHBORS, minSize=(MIN_FACE, MIN_FACE))
            total += len(faces)
    return total


def main() -> int:
    try:
        import cv2

        cascades = [cv2.CascadeClassifier(cv2.data.haarcascades + name)
                    for name in ("haarcascade_frontalface_default.xml", "haarcascade_profileface.xml")]
        if any(c.empty() for c in cascades):
            raise RuntimeError("failed to load Haar cascades")
        result = {p: count_faces(cv2, cascades, p) for p in sys.argv[1:]}
        print(json.dumps(result))
        return 0
    except Exception:  # noqa: BLE001 — log and fail closed
        LOG_FILE.parent.mkdir(exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {sys.argv[1:]}\n{traceback.format_exc()}\n")
        print(traceback.format_exc(limit=1), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
