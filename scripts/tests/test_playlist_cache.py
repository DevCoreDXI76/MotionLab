import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.playlist_cache import (
    PLAYLIST_TITLE,
    cached_playlist_id,
    load_cache,
    save_cache,
)


def test_load_cache_returns_empty_dict_when_missing(tmp_path):
    cache_path = tmp_path / "youtube_playlists.json"
    assert load_cache(cache_path) == {}


def test_save_then_load_round_trip(tmp_path):
    cache_path = tmp_path / "youtube_playlists.json"
    save_cache(cache_path, {PLAYLIST_TITLE: {"title": PLAYLIST_TITLE, "id": "PL123"}})
    loaded = load_cache(cache_path)
    assert loaded[PLAYLIST_TITLE]["id"] == "PL123"


def test_cached_playlist_id_returns_none_when_absent():
    assert cached_playlist_id({}) is None


def test_cached_playlist_id_returns_id_when_present():
    cache = {PLAYLIST_TITLE: {"title": PLAYLIST_TITLE, "id": "PL123"}}
    assert cached_playlist_id(cache) == "PL123"
