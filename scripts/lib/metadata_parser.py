import re
from pathlib import Path

TITLE_MAX_LEN = 100

_TITLE_RE = re.compile(r"제목:\s*(.*?)\n\n설명:", re.DOTALL)
_DESC_RE = re.compile(r"설명:\s*(.*?)\n\n해시태그:", re.DOTALL)
_TAGS_RE = re.compile(r"해시태그:\s*(.*)", re.DOTALL)


class MetadataParseError(Exception):
    """`.metadata.txt`에 제목/설명/해시태그 블록이 빠져 있을 때 발생."""


def parse_metadata_txt(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")

    title_match = _TITLE_RE.search(text)
    if not title_match:
        raise MetadataParseError(f"'제목:' 블록을 찾을 수 없습니다: {path}")

    desc_match = _DESC_RE.search(text)
    if not desc_match:
        raise MetadataParseError(f"'설명:' 블록을 찾을 수 없습니다: {path}")

    tags_match = _TAGS_RE.search(text)
    if not tags_match:
        raise MetadataParseError(f"'해시태그:' 블록을 찾을 수 없습니다: {path}")

    title = title_match.group(1).strip()[:TITLE_MAX_LEN]
    description = desc_match.group(1).strip()
    tags = [tok.lstrip("#") for tok in tags_match.group(1).split() if tok.lstrip("#")]

    return {"title": title, "description": description, "tags": tags}
