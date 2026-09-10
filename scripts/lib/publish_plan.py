def plan_publish_action(existing: dict, thumbnail_exists: bool, target_privacy: str | None) -> dict:
    """이미 업로드된 영상에 대해 썸네일 재적용/공개범위 전환이 필요한지 판단한다.

    existing: upload_result.json 내용 (thumbnail_set, uploaded_privacy 등).
    target_privacy: None이면 공개범위는 건드리지 않는다(썸네일만 재시도).
    """
    needs_thumbnail = thumbnail_exists and not existing.get("thumbnail_set", False)
    needs_privacy_update = (
        target_privacy is not None and existing.get("uploaded_privacy") != target_privacy
    )
    return {"needs_thumbnail": needs_thumbnail, "needs_privacy_update": needs_privacy_update}
