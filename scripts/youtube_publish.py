"""
이미 업로드된 영상(003~006 등)에 대해 썸네일을 재적용하거나 공개범위를 전환한다.

youtube_upload.py는 업로드 "시점"에만 썸네일/공개범위를 다룬다. 채널 전화번호 인증이
업로드 이후에 완료됐거나, private로 올린 뒤 공개 전환을 별도로 승인받은 경우 이 스크립트를 쓴다.

사용법:
  py scripts/youtube_publish.py --project projects/003_pipeline           # 썸네일만 재시도
  py scripts/youtube_publish.py --all --privacy public                    # 전부 공개 전환 + 썸네일 재시도
  py scripts/youtube_publish.py --project projects/003_pipeline --privacy unlisted

주의:
  --privacy를 생략하면 공개범위는 건드리지 않고 썸네일만 재시도한다. "public"/"unlisted"는
  사람이 채팅에서 명시적으로 승인한 뒤에만 사용할 것 — 스크립트 자체는 승인 여부를 판단할 수 없다.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib.publish_plan import plan_publish_action
from lib.upload_state import load_existing_upload, write_upload_result
from youtube_upload import VALID_PRIVACY, get_authenticated_service, set_thumbnail, update_privacy

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
PROJECTS_DIR = REPO_ROOT / "projects"


def find_all_project_dirs() -> list[Path]:
    if not PROJECTS_DIR.exists():
        return []
    return sorted(p for p in PROJECTS_DIR.iterdir() if p.is_dir())


def publish_one(youtube, project_dir: Path, target_privacy: str | None) -> None:
    project_id = project_dir.name
    thumbnail_path = project_dir / "output" / f"{project_id}.thumbnail.png"

    existing = load_existing_upload(project_dir)
    if not existing:
        print(f"[{project_id}] 건너뜀 — 업로드 기록 없음(youtube_upload.py로 먼저 업로드)")
        return

    plan = plan_publish_action(existing, thumbnail_path.exists(), target_privacy)
    video_id = existing["youtube_video_id"]

    if not plan["needs_thumbnail"] and not plan["needs_privacy_update"]:
        print(f"[{project_id}] 변경 없음 (video_id={video_id})")
        return

    print(f"[{project_id}] video_id={video_id}")

    if plan["needs_thumbnail"]:
        try:
            set_thumbnail(youtube, video_id, thumbnail_path)
            existing["thumbnail_set"] = True
            print("  썸네일 재적용 완료")
        except Exception as e:
            print(
                f"  (경고: 썸네일 설정 실패 — {e}\n"
                "   채널 전화번호 인증이 아직 안 됐을 수 있습니다. youtube.com/verify 확인 후 재시도하세요.)"
            )

    if plan["needs_privacy_update"]:
        try:
            update_privacy(youtube, video_id, target_privacy)
            existing["uploaded_privacy"] = target_privacy
            print(f"  공개범위 전환 완료 -> {target_privacy}")
        except Exception as e:
            print(f"  (경고: 공개범위 전환 실패 — {e})")

    write_upload_result(project_dir, existing)


def main() -> int:
    p = argparse.ArgumentParser()
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument("--project", help="예: projects/003_pipeline")
    group.add_argument("--all", action="store_true", help="업로드 기록이 있는 프로젝트 전부")
    p.add_argument(
        "--privacy",
        default=None,
        choices=VALID_PRIVACY,
        help="지정하면 공개범위를 이 값으로 전환한다. 생략하면 썸네일만 재시도. "
        "public/unlisted는 사람이 채팅으로 명시 승인한 뒤에만 사용.",
    )
    args = p.parse_args()

    if args.privacy and args.privacy != "private":
        print(
            f"⚠️  --privacy={args.privacy}로 공개범위를 전환합니다. 사람이 채팅에서 명시적으로 "
            "승인한 경우에만 진행하세요. 승인받지 않았다면 지금 Ctrl+C로 중단하세요."
        )

    project_dirs = [Path(args.project)] if args.project else find_all_project_dirs()
    if not project_dirs:
        print("대상 프로젝트가 없습니다.")
        return 1

    youtube = get_authenticated_service()
    for project_dir in project_dirs:
        publish_one(youtube, project_dir, args.privacy)

    return 0


if __name__ == "__main__":
    sys.exit(main())
