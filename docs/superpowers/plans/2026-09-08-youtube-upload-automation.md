# 유튜브 업로드 자동화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `projects/<id>_<name>/output/*.mp4`를 `@MotionLab.coredxi` 채널에 CLI 한 번으로 업로드하는
Python 스크립트(`scripts/youtube_upload.py`)를 만든다.

**Architecture:** motiontoon-project의 검증된 OAuth 업로드 패턴을 MotionLab 구조(평문
`.metadata.txt`, `projects/<id>_<name>/output/` 레이아웃)에 맞게 이식한다. 순수 로직(메타데이터
파싱, 업로드 상태 기록, 재생목록 캐시, 업로드 body 생성)은 `scripts/lib/`의 독립 모듈로 분리해
네트워크 없이 단위 테스트하고, 인증·실제 API 호출·CLI 오케스트레이션은 `scripts/youtube_upload.py`
하나에 모아 motiontoon과 동일하게 수동으로 검증한다.

**Tech Stack:** Python 3.11(`py.exe`), `google-api-python-client`, `google-auth-oauthlib`,
`google-auth-httplib2`, pytest.

**Spec:** [docs/superpowers/specs/2026-09-08-youtube-upload-automation-design.md](../specs/2026-09-08-youtube-upload-automation-design.md)

## Global Constraints

- 대상 채널: `@MotionLab.coredxi` (다른 채널 지원 없음, v1)
- 자격증명은 `secrets/`에만 두고 절대 커밋하지 않는다 — `.gitignore`에 `secrets/` 추가 필수.
- `--privacy` 기본값은 `private`. `unlisted`/`public`은 사람이 채팅에서 명시 승인한 경우에만
  그 값으로 스크립트를 실행한다 — 스크립트는 판단하지 않고 경고만 출력한다.
- 이미 `<id>_<name>.upload_result.json`이 있으면 `--force` 없이는 재업로드하지 않는다.
- `<id>_<name>.metadata.txt`의 제목/설명/해시태그 세 블록 중 하나라도 없으면 즉시 에러로 중단한다.
- 재생목록/썸네일 등 "업로드 자체는 끝난 뒤" 단계의 실패로 전체 업로드를 실패 처리하지 않는다
  (경고만 출력, `upload_result.json`에 실패 내역 기록).
- render 파이프라인이나 다른 스크립트에서 이 스크립트를 자동 트리거하지 않는다 — 항상 사람이
  직접 실행.

## 사전 준비 (사람이 1회, 이 플랜 실행 전에)

Task 6까지는 credential 없이도 구현·테스트 가능하지만, Task 7(실제 업로드 검증)을 하려면
먼저 사람이 Google Cloud Console에서 OAuth 클라이언트를 발급해 `secrets/youtube_client_secret.json`
으로 저장해야 한다. 절차는 스펙 문서의 "인증" 절 및 Task 6에서 만들 스크립트 docstring 참고.

---

### Task 1: 프로젝트 스캐폴딩

**Files:**
- Create: `scripts/lib/__init__.py`
- Create: `scripts/tests/__init__.py`
- Create: `scripts/requirements.txt`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `scripts/lib/`, `scripts/tests/` 패키지 디렉토리(이후 모든 Task가 여기에 파일을 추가함)

- [ ] **Step 1: 디렉토리와 빈 패키지 파일 생성**

```bash
mkdir -p scripts/lib scripts/tests
touch scripts/lib/__init__.py scripts/tests/__init__.py
```

- [ ] **Step 2: 의존성 파일 작성**

`scripts/requirements.txt`:
```
google-api-python-client
google-auth-oauthlib
google-auth-httplib2
```

- [ ] **Step 3: `.gitignore`에 `secrets/` 추가**

`.gitignore` 끝에 추가:
```
secrets/
```

- [ ] **Step 4: 의존성 설치 확인**

```bash
py -m pip install -r scripts/requirements.txt
py -c "import googleapiclient, google_auth_oauthlib, google.auth; print('ok')"
```

Expected: `ok` 출력, 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/__init__.py scripts/tests/__init__.py scripts/requirements.txt .gitignore
git commit -m "chore: scaffold youtube upload script package

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: 메타데이터 파서

**Files:**
- Create: `scripts/lib/metadata_parser.py`
- Test: `scripts/tests/test_metadata_parser.py`

**Interfaces:**
- Produces:
  - `class MetadataParseError(Exception)`
  - `def parse_metadata_txt(path: Path) -> dict` — 반환값
    `{"title": str, "description": str, "tags": list[str]}`. `title`은 100자 초과 시 자름.
    `제목:`/`설명:`/`해시태그:` 블록 중 하나라도 없으면 `MetadataParseError` 발생.

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/test_metadata_parser.py`:
```python
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
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `py -m pytest scripts/tests/test_metadata_parser.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'lib.metadata_parser'`

- [ ] **Step 3: 최소 구현 작성**

`scripts/lib/metadata_parser.py`:
```python
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
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `py -m pytest scripts/tests/test_metadata_parser.py -v`
Expected: 5개 테스트 모두 PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/metadata_parser.py scripts/tests/test_metadata_parser.py
git commit -m "feat: add metadata.txt parser for youtube upload

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: 업로드 상태(중복 방지) 헬퍼

**Files:**
- Create: `scripts/lib/upload_state.py`
- Test: `scripts/tests/test_upload_state.py`

**Interfaces:**
- Consumes: 없음 (독립 모듈)
- Produces:
  - `def upload_result_path(project_dir: Path) -> Path` — `project_dir`(예:
    `projects/003_pipeline`) 안의 `output/003_pipeline.upload_result.json` 경로를 반환.
    폴더명에서 `<id>_<name>` 부분을 그대로 파일명 접두어로 사용한다.
  - `def load_existing_upload(project_dir: Path) -> dict | None` — 결과 파일이 있으면 파싱해서
    반환, 없으면 `None`.
  - `def write_upload_result(project_dir: Path, result: dict) -> None` — 결과 파일에
    JSON(ensure_ascii=False, indent=2)으로 저장.

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/test_upload_state.py`:
```python
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.upload_state import (
    load_existing_upload,
    upload_result_path,
    write_upload_result,
)


def make_project(tmp_path: Path) -> Path:
    project_dir = tmp_path / "003_pipeline"
    (project_dir / "output").mkdir(parents=True)
    return project_dir


def test_upload_result_path_uses_project_folder_name(tmp_path):
    project_dir = make_project(tmp_path)
    result = upload_result_path(project_dir)
    assert result == project_dir / "output" / "003_pipeline.upload_result.json"


def test_load_existing_upload_returns_none_when_missing(tmp_path):
    project_dir = make_project(tmp_path)
    assert load_existing_upload(project_dir) is None


def test_write_then_load_round_trip(tmp_path):
    project_dir = make_project(tmp_path)
    write_upload_result(project_dir, {"youtube_video_id": "abc123"})
    loaded = load_existing_upload(project_dir)
    assert loaded == {"youtube_video_id": "abc123"}

    raw = json.loads(upload_result_path(project_dir).read_text(encoding="utf-8"))
    assert raw["youtube_video_id"] == "abc123"
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `py -m pytest scripts/tests/test_upload_state.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'lib.upload_state'`

- [ ] **Step 3: 최소 구현 작성**

`scripts/lib/upload_state.py`:
```python
import json
from pathlib import Path


def upload_result_path(project_dir: Path) -> Path:
    project_id = project_dir.name  # 예: "003_pipeline"
    return project_dir / "output" / f"{project_id}.upload_result.json"


def load_existing_upload(project_dir: Path) -> dict | None:
    path = upload_result_path(project_dir)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def write_upload_result(project_dir: Path, result: dict) -> None:
    path = upload_result_path(project_dir)
    path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `py -m pytest scripts/tests/test_upload_state.py -v`
Expected: 3개 테스트 모두 PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/upload_state.py scripts/tests/test_upload_state.py
git commit -m "feat: add upload result state helpers for duplicate-upload guard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: 업로드 body 빌더

**Files:**
- Create: `scripts/lib/video_body.py`
- Test: `scripts/tests/test_video_body.py`

**Interfaces:**
- Consumes: `parse_metadata_txt()`가 반환하는 `{"title", "description", "tags"}` 형태의 dict
- Produces: `def build_video_body(meta: dict, privacy: str) -> dict` — `youtube.videos().insert(body=...)`
  에 그대로 넘길 수 있는 dict:
  `{"snippet": {"title", "description", "tags", "categoryId": "22"}, "status": {"privacyStatus", "selfDeclaredMadeForKids": False}}`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/test_video_body.py`:
```python
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
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `py -m pytest scripts/tests/test_video_body.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'lib.video_body'`

- [ ] **Step 3: 최소 구현 작성**

`scripts/lib/video_body.py`:
```python
def build_video_body(meta: dict, privacy: str) -> dict:
    return {
        "snippet": {
            "title": meta["title"],
            "description": meta["description"],
            "tags": meta["tags"],
            "categoryId": "22",  # People & Blogs (motiontoon과 동일 카테고리)
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `py -m pytest scripts/tests/test_video_body.py -v`
Expected: 2개 테스트 모두 PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/video_body.py scripts/tests/test_video_body.py
git commit -m "feat: add youtube video body builder

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: 재생목록 캐시 헬퍼

**Files:**
- Create: `scripts/lib/playlist_cache.py`
- Test: `scripts/tests/test_playlist_cache.py`

**Interfaces:**
- Produces:
  - `PLAYLIST_TITLE = "모션랩 빌드로그"` (모듈 상수)
  - `def load_cache(cache_path: Path) -> dict` — 파일 없으면 `{}`
  - `def save_cache(cache_path: Path, cache: dict) -> None`
  - `def cached_playlist_id(cache: dict) -> str | None` — `cache.get("모션랩 빌드로그", {}).get("id")`
- 참고: 실제 YouTube API를 호출하는 `find_playlist_by_title` / `get_or_create_playlist` /
  `add_video_to_playlist`는 이 모듈이 아니라 Task 6의 `youtube_upload.py`에 둔다(스펙의
  "업로드 자체는 실제 API 호출이라 자동 테스트 대상이 아님" 원칙 — `youtube` 클라이언트 객체가
  필요한 함수는 네트워크 의존적이라 이 Task의 순수 캐시 로직과 분리한다).

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/test_playlist_cache.py`:
```python
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
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `py -m pytest scripts/tests/test_playlist_cache.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'lib.playlist_cache'`

- [ ] **Step 3: 최소 구현 작성**

`scripts/lib/playlist_cache.py`:
```python
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
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `py -m pytest scripts/tests/test_playlist_cache.py -v`
Expected: 4개 테스트 모두 PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/playlist_cache.py scripts/tests/test_playlist_cache.py
git commit -m "feat: add playlist id cache helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: 메인 CLI — 인증·업로드·재생목록 오케스트레이션

**Files:**
- Create: `scripts/youtube_upload.py`

**Interfaces:**
- Consumes:
  - `lib.metadata_parser.parse_metadata_txt(path) -> dict`
  - `lib.upload_state.load_existing_upload(project_dir) -> dict | None`
  - `lib.upload_state.write_upload_result(project_dir, result: dict) -> None`
  - `lib.video_body.build_video_body(meta, privacy) -> dict`
  - `lib.playlist_cache.{PLAYLIST_TITLE, load_cache, save_cache, cached_playlist_id}`
- Produces: CLI 진입점(`py scripts/youtube_upload.py --project ... [--privacy ...] [--force]`),
  다른 Task/모듈이 이 파일을 import하지 않으므로 이 파일이 노출하는 함수 시그니처는 계약 대상이
  아니다(자유롭게 구현).

이 Task는 실제 Google API 호출·OAuth 브라우저 흐름을 포함해 자동 테스트가 불가능하다(스펙
"테스트" 절 참고). 대신 Step 마지막에 `--help` 스모크 체크로 임포트/argparse 배선이 깨지지
않았는지만 확인하고, 실제 업로드 동작 검증은 Task 7에서 수행한다.

- [ ] **Step 1: 스크립트 작성**

`scripts/youtube_upload.py`:
```python
"""
유튜브 업로드(@MotionLab.coredxi 채널) — 사람이 배포 단계에서 직접 실행한다.
render 파이프라인 등 다른 스크립트가 이 스크립트를 자동 호출하지 않는다.

사전 준비 (사람이 1회만, Google Cloud Console에서):
  1. https://console.cloud.google.com 에서 프로젝트 생성
  2. "YouTube Data API v3" 활성화 (API 및 서비스 > 라이브러리)
  3. OAuth 동의 화면 구성 (User Type: 외부, 테스트 모드로 충분 —
     @MotionLab.coredxi를 관리하는 구글 계정을 테스트 사용자로 추가)
  4. 사용자 인증 정보 > OAuth 클라이언트 ID 만들기 (애플리케이션 유형: 데스크톱 앱)
  5. 다운로드한 JSON을 secrets/youtube_client_secret.json 으로 저장
  6. py -m pip install -r scripts/requirements.txt

사용법:
  py scripts/youtube_upload.py --project projects/003_pipeline
  py scripts/youtube_upload.py --project projects/003_pipeline --privacy unlisted  # 명시적 승인 후에만
  py scripts/youtube_upload.py --project projects/003_pipeline --force  # 이미 업로드돼 있어도 재업로드

주의:
  --privacy 기본값은 "private"이다. "public"/"unlisted"는 사람이 채팅에서 명시적으로 승인한
  뒤에만 이 옵션으로 실행할 것 — 스크립트 자체는 승인 여부를 판단할 수 없다.
"""

import argparse
import datetime
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib.metadata_parser import MetadataParseError, parse_metadata_txt
from lib.playlist_cache import (
    PLAYLIST_TITLE,
    cached_playlist_id,
    load_cache,
    save_cache,
)
from lib.upload_state import load_existing_upload, write_upload_result
from lib.video_body import build_video_body

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
CLIENT_SECRETS_FILE = REPO_ROOT / "secrets" / "youtube_client_secret.json"
TOKEN_FILE = REPO_ROOT / "secrets" / "youtube_token.json"
PLAYLIST_CACHE_FILE = REPO_ROOT / "secrets" / "youtube_playlists.json"
SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]
VALID_PRIVACY = ("private", "unlisted", "public")


def get_authenticated_service():
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except ImportError:
        print(
            "필요한 라이브러리가 없습니다. 먼저 설치하세요:\n"
            "  py -m pip install -r scripts/requirements.txt"
        )
        raise SystemExit(1)

    if not CLIENT_SECRETS_FILE.exists():
        print(
            f"OAuth 클라이언트 파일이 없습니다: {CLIENT_SECRETS_FILE}\n"
            "Google Cloud Console에서 OAuth 클라이언트 ID(데스크톱 앱)를 만들고 다운로드한 "
            f"JSON을 {CLIENT_SECRETS_FILE} 경로에 저장하세요. (이 파일 상단 docstring 참고)"
        )
        raise SystemExit(1)

    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception:
                creds = None
        if not creds or not creds.valid:
            flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRETS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)
        TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
        TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")

    return build("youtube", "v3", credentials=creds)


def resumable_upload(request):
    from googleapiclient.errors import HttpError

    response = None
    retry = 0
    while response is None:
        try:
            status, response = request.next_chunk()
            if status:
                print(f"  업로드 진행률: {int(status.progress() * 100)}%")
        except HttpError as e:
            if e.resp.status in (500, 502, 503, 504) and retry < 10:
                retry += 1
                wait = 2**retry
                print(f"  일시적 오류(재시도 {retry}/10, {wait}초 대기): {e}")
                time.sleep(wait)
                continue
            raise
    return response


def find_playlist_by_title(youtube, title: str):
    page_token = None
    while True:
        resp = youtube.playlists().list(
            part="snippet", mine=True, maxResults=50, pageToken=page_token
        ).execute()
        for item in resp.get("items", []):
            if item["snippet"]["title"] == title:
                return item["id"]
        page_token = resp.get("nextPageToken")
        if not page_token:
            return None


def get_or_create_playlist(youtube) -> str:
    cache = load_cache(PLAYLIST_CACHE_FILE)
    cached_id = cached_playlist_id(cache)
    if cached_id:
        return cached_id

    playlist_id = find_playlist_by_title(youtube, PLAYLIST_TITLE)
    if not playlist_id:
        print(f"  재생목록 '{PLAYLIST_TITLE}' 없음 -> 새로 생성")
        resp = youtube.playlists().insert(
            part="snippet,status",
            body={
                "snippet": {
                    "title": PLAYLIST_TITLE,
                    "description": f"{PLAYLIST_TITLE} — 파이프라인이 자동 생성한 재생목록입니다.",
                },
                "status": {"privacyStatus": "public"},
            },
        ).execute()
        playlist_id = resp["id"]
    else:
        print(f"  기존 재생목록 '{PLAYLIST_TITLE}' 발견 (id={playlist_id})")

    cache[PLAYLIST_TITLE] = {"title": PLAYLIST_TITLE, "id": playlist_id}
    save_cache(PLAYLIST_CACHE_FILE, cache)
    return playlist_id


def add_video_to_playlist(youtube, playlist_id: str, video_id: str) -> None:
    youtube.playlistItems().insert(
        part="snippet",
        body={
            "snippet": {
                "playlistId": playlist_id,
                "resourceId": {"kind": "youtube#video", "videoId": video_id},
            }
        },
    ).execute()


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--project", required=True, help="예: projects/003_pipeline")
    p.add_argument(
        "--privacy",
        default="private",
        choices=VALID_PRIVACY,
        help="기본 private. public/unlisted는 사람이 채팅으로 명시 승인한 뒤에만 사용.",
    )
    p.add_argument("--force", action="store_true", help="이미 업로드돼 있어도 재업로드")
    args = p.parse_args()

    project_dir = Path(args.project)
    project_id = project_dir.name
    video_path = project_dir / "output" / f"{project_id}.mp4"
    metadata_path = project_dir / "output" / f"{project_id}.metadata.txt"

    if not video_path.exists():
        print(f"파일 없음: {video_path}")
        return 1
    if not metadata_path.exists():
        print(f"파일 없음: {metadata_path}")
        return 1

    existing = load_existing_upload(project_dir)
    if existing and not args.force:
        print(
            f"이미 업로드됨 -> {existing.get('youtube_url')} "
            "(재업로드하려면 --force)"
        )
        return 0

    try:
        meta = parse_metadata_txt(metadata_path)
    except MetadataParseError as e:
        print(f"메타데이터 파싱 실패: {e}")
        return 1

    if args.privacy != "private":
        print(
            f"⚠️  --privacy={args.privacy}로 실행하려고 합니다. 이건 사람이 채팅에서 "
            "명시적으로 승인한 경우에만 해야 합니다. 승인받지 않았다면 지금 Ctrl+C로 중단하세요."
        )

    from googleapiclient.http import MediaFileUpload

    youtube = get_authenticated_service()
    body = build_video_body(meta, args.privacy)

    print(f"[업로드] {video_path} -> YouTube (privacyStatus={args.privacy})")
    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=MediaFileUpload(str(video_path), chunksize=-1, resumable=True),
    )
    response = resumable_upload(request)
    video_id = response["id"]
    video_url = f"https://youtu.be/{video_id}"
    print(f"\n업로드 완료 -> {video_url} (privacyStatus={args.privacy})")

    try:
        playlist_id = get_or_create_playlist(youtube)
        add_video_to_playlist(youtube, playlist_id, video_id)
        playlist_result = {"playlist_id": playlist_id, "added": True}
        print(f"  재생목록 '{PLAYLIST_TITLE}'에 추가 완료")
    except Exception as e:
        playlist_result = {"playlist_id": None, "added": False, "error": str(e)}
        print(
            f"  (경고: 재생목록 추가 실패 — {e}\n"
            "   영상 업로드 자체는 정상적으로 완료됐습니다. YouTube Studio에서 수동으로 "
            "재생목록에 추가해주세요.)"
        )

    write_upload_result(
        project_dir,
        {
            "youtube_video_id": video_id,
            "youtube_url": video_url,
            "uploaded_privacy": args.privacy,
            "uploaded_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "playlist_result": playlist_result,
        },
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: import/argparse 배선 스모크 체크**

Run: `py scripts/youtube_upload.py --help`
Expected: 에러 없이 usage 메시지 출력 (아직 `secrets/youtube_client_secret.json`이 없어도 이
단계는 통과해야 한다 — `get_authenticated_service()`는 `main()` 내부에서만 호출되므로 `--help`
경로에서는 실행되지 않는다).

- [ ] **Step 3: 필수 파일 누락 시 에러 종료 확인**

Run: `py scripts/youtube_upload.py --project projects/does_not_exist`
Expected: `파일 없음: projects/does_not_exist/output/does_not_exist.mp4` 출력, exit code 1
(`echo $?`로 확인)

- [ ] **Step 4: Commit**

```bash
git add scripts/youtube_upload.py
git commit -m "feat: add youtube_upload.py CLI — auth, upload, playlist orchestration

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: 실업로드 수동 검증 (003_pipeline)

이 Task는 자동화된 단계가 아니다 — 스펙의 "업로드 자체는 실제 YouTube API 호출이라 자동
테스트 대상이 아님" 원칙에 따라 사람이 직접 확인한다. **사전 준비(위 "사전 준비" 절)가 끝나
`secrets/youtube_client_secret.json`이 있어야 진행 가능.**

- [ ] **Step 1: 003_pipeline을 private로 실제 업로드**

```bash
py scripts/youtube_upload.py --project projects/003_pipeline
```

Expected: 브라우저가 열려 `@MotionLab.coredxi`를 관리하는 구글 계정으로 OAuth 동의 →
업로드 진행률 로그 → `업로드 완료 -> https://youtu.be/<video_id>` 출력 → `재생목록 '모션랩
빌드로그'에 추가 완료` 출력.

- [ ] **Step 2: 산출물 확인**

```bash
cat projects/003_pipeline/output/003_pipeline.upload_result.json
```

Expected: `youtube_video_id`, `youtube_url`, `uploaded_privacy: "private"`,
`playlist_result.added: true` 확인.

- [ ] **Step 3: 재업로드 방지(중복 가드) 확인**

```bash
py scripts/youtube_upload.py --project projects/003_pipeline
```

Expected: `이미 업로드됨 -> https://youtu.be/<video_id> (재업로드하려면 --force)` 출력,
새 업로드가 발생하지 않음(exit 0).

- [ ] **Step 4: YouTube Studio에서 눈으로 확인**

`@MotionLab.coredxi` 채널 → YouTube Studio → 콘텐츠에서 영상이 비공개(private)로 올라와
있는지, "모션랩 빌드로그" 재생목록이 생성되고 이 영상이 포함돼 있는지 확인.

- [ ] **Step 5: 나머지 3편 반복**

004_failures, 005_casting, 006_recap도 동일하게 `--project`만 바꿔 실행:

```bash
py scripts/youtube_upload.py --project projects/004_failures
py scripts/youtube_upload.py --project projects/005_casting
py scripts/youtube_upload.py --project projects/006_recap
```

- [ ] **Step 6: 공개 전환 여부는 별도 판단**

4편 모두 private로 올라온 상태를 사람이 확인한 뒤, 공개 범위를 바꿀지(unlisted/public)는
채팅에서 별도로 명시 승인받는다 — 이 Task에서는 자동으로 전환하지 않는다.
