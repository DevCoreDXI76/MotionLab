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
