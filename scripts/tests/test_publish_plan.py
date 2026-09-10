import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.publish_plan import plan_publish_action


def test_no_action_when_thumbnail_set_and_privacy_matches():
    existing = {"thumbnail_set": True, "uploaded_privacy": "public"}
    plan = plan_publish_action(existing, thumbnail_exists=True, target_privacy="public")
    assert plan == {"needs_thumbnail": False, "needs_privacy_update": False}


def test_needs_thumbnail_when_file_exists_and_not_yet_set():
    existing = {"thumbnail_set": False, "uploaded_privacy": "private"}
    plan = plan_publish_action(existing, thumbnail_exists=True, target_privacy=None)
    assert plan["needs_thumbnail"] is True


def test_no_thumbnail_action_when_file_missing():
    existing = {"thumbnail_set": False, "uploaded_privacy": "private"}
    plan = plan_publish_action(existing, thumbnail_exists=False, target_privacy=None)
    assert plan["needs_thumbnail"] is False


def test_missing_thumbnail_set_key_treated_as_not_set():
    existing = {"uploaded_privacy": "private"}  # 003_pipeline처럼 필드 자체가 없는 과거 기록
    plan = plan_publish_action(existing, thumbnail_exists=True, target_privacy=None)
    assert plan["needs_thumbnail"] is True


def test_needs_privacy_update_when_target_differs():
    existing = {"thumbnail_set": True, "uploaded_privacy": "private"}
    plan = plan_publish_action(existing, thumbnail_exists=True, target_privacy="public")
    assert plan["needs_privacy_update"] is True


def test_no_privacy_update_when_target_is_none():
    existing = {"thumbnail_set": True, "uploaded_privacy": "private"}
    plan = plan_publish_action(existing, thumbnail_exists=True, target_privacy=None)
    assert plan["needs_privacy_update"] is False


def test_no_privacy_update_when_already_matches_target():
    existing = {"thumbnail_set": True, "uploaded_privacy": "public"}
    plan = plan_publish_action(existing, thumbnail_exists=True, target_privacy="public")
    assert plan["needs_privacy_update"] is False
