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
