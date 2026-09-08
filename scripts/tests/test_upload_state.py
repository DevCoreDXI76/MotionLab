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
