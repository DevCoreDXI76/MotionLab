def build_video_body(meta: dict, privacy: str) -> dict:
    status = {
        "privacyStatus": privacy,
        "selfDeclaredMadeForKids": False,
    }
    # 실사풍 AI 이미지·AI 영상이 들어간 편만 표시한다(docs/2단계_설계.md D6). 001~007은 키 자체가 없다.
    if meta.get("containsSyntheticMedia"):
        status["containsSyntheticMedia"] = True
    return {
        "snippet": {
            "title": meta["title"],
            "description": meta["description"],
            "tags": meta["tags"],
            "categoryId": "22",  # People & Blogs (motiontoon과 동일 카테고리)
        },
        "status": status,
    }
