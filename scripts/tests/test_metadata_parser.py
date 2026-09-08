import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.metadata_parser import MetadataParseError, parse_metadata_txt

VALID_TEXT = (
    "제목: 이 영상, 사람은 5분만 일했어요\n"
    "\n"
    "설명: 이 영상 한 편, 사람이 손댄 시간은 딱 5분이에요. 나머지는 전부 자동으로 이어져요.\n"
    "\n"
    "해시태그: #shorts #모션랩 #자동화영상\n"
)


def write(tmp_path: Path, text: str) -> Path:
    p = tmp_path / "003_pipeline.metadata.txt"
    p.write_text(text, encoding="utf-8")
    return p


def test_parses_valid_metadata(tmp_path):
    path = write(tmp_path, VALID_TEXT)
    result = parse_metadata_txt(path)
    assert result["title"] == "이 영상, 사람은 5분만 일했어요"
    assert result["description"].startswith("이 영상 한 편")
    assert result["tags"] == ["shorts", "모션랩", "자동화영상"]


def test_title_truncated_to_100_chars(tmp_path):
    long_title = "가" * 150
    text = f"제목: {long_title}\n\n설명: 설명입니다\n\n해시태그: #shorts\n"
    path = write(tmp_path, text)
    result = parse_metadata_txt(path)
    assert len(result["title"]) == 100


def test_missing_title_raises(tmp_path):
    text = "설명: 설명만 있음\n\n해시태그: #shorts\n"
    path = write(tmp_path, text)
    with pytest.raises(MetadataParseError):
        parse_metadata_txt(path)


def test_missing_description_raises(tmp_path):
    text = "제목: 제목만 있음\n\n해시태그: #shorts\n"
    path = write(tmp_path, text)
    with pytest.raises(MetadataParseError):
        parse_metadata_txt(path)


def test_missing_hashtags_raises(tmp_path):
    text = "제목: 제목\n\n설명: 설명\n"
    path = write(tmp_path, text)
    with pytest.raises(MetadataParseError):
        parse_metadata_txt(path)
