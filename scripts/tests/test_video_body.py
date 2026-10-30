import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.video_body import build_video_body

META = {"title": "제목", "description": "설명", "tags": ["shorts", "모션랩"]}


def test_build_video_body_shapes_snippet_and_status():
    body = build_video_body(META, privacy="private")
    assert body["snippet"]["title"] == "제목"
    assert body["snippet"]["description"] == "설명"
    assert body["snippet"]["tags"] == ["shorts", "모션랩"]
    assert body["snippet"]["categoryId"] == "22"
    assert body["status"]["privacyStatus"] == "private"
    assert body["status"]["selfDeclaredMadeForKids"] is False


def test_build_video_body_uses_given_privacy():
    body = build_video_body(META, privacy="unlisted")
    assert body["status"]["privacyStatus"] == "unlisted"


def test_build_video_body_omits_synthetic_flag_for_existing_episodes():
    assert "containsSyntheticMedia" not in build_video_body(META, privacy="private")["status"]


def test_build_video_body_flags_synthetic_media():
    body = build_video_body({**META, "containsSyntheticMedia": True}, privacy="private")
    assert body["status"]["containsSyntheticMedia"] is True
