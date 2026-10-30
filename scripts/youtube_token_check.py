"""YouTube 토큰 사전 점검 (produce.ts preflight) — 업로드 없이 인증만 확인한다.

secrets/youtube_token.json을 읽어 유효하거나, 만료됐지만 refresh token으로 갱신 가능한지
(메모리에서만 갱신, 파일은 쓰지 않음) 확인한다. 브라우저 로그인이 필요하면 exit 2 —
오케스트레이터는 렌더 전에 멈추고 사람 개입으로 기록한다.

출력: "ok" | "needs_login: <사유>" (토큰 값은 출력하지 않음). 오류는 logs/youtube_token_check_errors.log.
사용법: py scripts/youtube_token_check.py
"""
import sys
import traceback
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TOKEN_FILE = REPO_ROOT / "secrets" / "youtube_token.json"
LOG_FILE = REPO_ROOT / "logs" / "youtube_token_check_errors.log"
SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]


def main() -> int:
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials

        if not TOKEN_FILE.exists():
            print("needs_login: secrets/youtube_token.json 없음")
            return 2
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
        if creds.valid:
            print("ok")
            return 0
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            print("ok")
            return 0
        print("needs_login: 유효하지 않고 refresh token도 없음")
        return 2
    except Exception as e:  # noqa: BLE001 — 갱신 거부(만료된 refresh token 등) 포함
        LOG_FILE.parent.mkdir(exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(f"[{datetime.now():%Y-%m-%d %H:%M:%S}]\n{traceback.format_exc()}\n")
        print(f"needs_login: {type(e).__name__}")
        return 2


if __name__ == "__main__":
    sys.exit(main())
