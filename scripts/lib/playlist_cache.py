import json
from pathlib import Path

PLAYLIST_TITLE = "모션랩 빌드로그"


def load_cache(cache_path: Path) -> dict:
    if not cache_path.exists():
        return {}
    return json.loads(cache_path.read_text(encoding="utf-8"))


def save_cache(cache_path: Path, cache: dict) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def cached_playlist_id(cache: dict) -> str | None:
    return cache.get(PLAYLIST_TITLE, {}).get("id")
