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


def set_thumbnail(youtube, video_id: str, thumbnail_path: Path) -> None:
    from googleapiclient.http import MediaFileUpload

    youtube.thumbnails().set(videoId=video_id, media_body=MediaFileUpload(str(thumbnail_path))).execute()


def update_privacy(youtube, video_id: str, privacy: str) -> None:
    youtube.videos().update(
        part="status",
        body={"id": video_id, "status": {"privacyStatus": privacy}},
    ).execute()


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
    thumbnail_path = project_dir / "output" / f"{project_id}.thumbnail.png"

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
        media_body=MediaFileUpload(str(video_path), chunksize=1024 * 1024 * 4, resumable=True),
    )
    response = resumable_upload(request)
    video_id = response["id"]
    video_url = f"https://youtu.be/{video_id}"
    print(f"\n업로드 완료 -> {video_url} (privacyStatus={args.privacy})")

    thumbnail_set = False
    if thumbnail_path.exists():
        try:
            set_thumbnail(youtube, video_id, thumbnail_path)
            thumbnail_set = True
            print(f"  썸네일 설정 완료 ({thumbnail_path.name})")
        except Exception as e:
            # 커스텀 썸네일 API 설정은 전화번호로 확인된 채널에서만 허용된다 — 업로드 자체는
            # 이미 끝났으니 이 실패로 전체를 실패 처리하지 않는다.
            print(
                f"  (경고: 썸네일 설정 실패 — {e}\n"
                "   커스텀 썸네일은 전화번호로 '확인된' 채널만 API로 설정할 수 있습니다. "
                "youtube.com/verify에서 채널을 확인하거나, YouTube Studio에서 수동으로 "
                "썸네일을 올려주세요. 영상 업로드 자체는 정상적으로 완료됐습니다.)"
            )
    else:
        print(f"  (썸네일 파일 없음: {thumbnail_path} — 건너뜀)")

    playlist_id = None
    try:
        playlist_id = get_or_create_playlist(youtube)
        add_video_to_playlist(youtube, playlist_id, video_id)
        playlist_result = {"playlist_id": playlist_id, "added": True}
        print(f"  재생목록 '{PLAYLIST_TITLE}'에 추가 완료")
    except Exception as e:
        # get_or_create_playlist가 이미 성공했다면 playlist_id에 실제 값이 남아 있으므로
        # add_video_to_playlist만 실패한 경우에도 어느 재생목록에 수동으로 추가해야 하는지 보존한다.
        playlist_result = {"playlist_id": playlist_id, "added": False, "error": str(e)}
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
            # 요청값(args.privacy)이 아니라 응답값을 기록한다: YouTube는 미인증/신규 채널 등에서
            # 요청한 privacyStatus를 무시하고 private로 강제 적용할 수 있어, API가 실제로
            # 확정한 값을 남겨야 한다. 응답에 필드가 없을 때만 요청값으로 대체한다.
            "uploaded_privacy": response.get("status", {}).get("privacyStatus", args.privacy),
            "uploaded_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "thumbnail_set": thumbnail_set,
            "playlist_result": playlist_result,
        },
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
