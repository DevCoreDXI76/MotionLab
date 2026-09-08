# 유튜브 업로드 자동화 — 설계 문서

- 작성일: 2026-09-08
- 대상 채널: `@MotionLab.coredxi` (2026-09-08 개설)
- 참고 구현: `motiontoon-project/scripts/youtube_upload.py`,
  `motiontoon-project/scripts/youtube_set_privacy.py` (자격증명 파일 자체는 읽지 않았음 — 새
  채널이라 어차피 새로 OAuth 인증 필요)

## 배경 / 결정 번복 기록

`docs/superpowers/plans/2026-08-15-motionlab-remotion-pipeline.md`(스펙 §8 인용)의 1차 스코프는
"배포는 1차에서 수동 업로드만 지원한다... 업로드 API 연동은 하지 않는다"였고,
`docs/remotion_트레이드오프_claudecode인계.md`(트레이드오프 8번 항목)에도 같은 결정이 "확정"으로
기록돼 있었다. 003~006 4편이 쌓인 시점에 매 편 수동 업로드가 반복 작업이 되어 이 결정을
뒤집는다. motiontoon-project에 이미 검증된 패턴(OAuth 데스크톱 앱 흐름, 재생목록 자동 분류,
private 기본값 + 명시 승인 시에만 공개 전환)이 있어 그대로 참고했다.

## 스코프

- 003_pipeline ~ 006_recap 4편 + 007편부터 전부 이 스크립트로 업로드(003~006은 아직 하나도
  수동 업로드된 적 없음, 2026-09-08 확인).
- 대상 채널 하나(`@MotionLab.coredxi`)만 다룬다. 김부장 본편 채널 연결(설명란 링크 노출,
  "1단계")은 이 스펙의 범위 밖 — 별도 판단 항목으로 남아 있음.
- 썸네일 자동 설정은 v1 범위 밖(아래 "제외 항목" 참고).

## 디렉토리 / 파일

```
MotionLab/
  scripts/
    youtube_upload.py       # 신규 — 이 스펙의 본체
  secrets/                  # 신규, .gitignore 추가
    youtube_client_secret.json   # 사람이 Google Cloud Console에서 1회 발급
    youtube_token.json           # 스크립트가 최초 인증 후 자동 생성/갱신
    youtube_playlists.json       # 재생목록 제목 -> id 캐시
  projects/<id>_<name>/output/
    <id>_<name>.mp4                    # 기존 산출물(변경 없음)
    <id>_<name>.metadata.txt           # 기존 산출물(변경 없음, 그대로 파싱)
    <id>_<name>.upload_result.json     # 신규 — 업로드 결과 기록(output/는 이미 gitignore 대상)
```

`scripts/`는 레포 루트에 Node용 `remotion/scripts/`와 나란히 둔다 — Python이라 기존 TS
파이프라인 코드와 섞지 않는다.

## 인증

- motiontoon과 동일한 OAuth "데스크톱 앱" 흐름: `google-api-python-client`,
  `google-auth-oauthlib`, `google-auth-httplib2` 사용.
- SCOPES: `youtube.upload` + `youtube.force-ssl`(업로드 + 재생목록 읽기/쓰기 포괄).
- **사전 준비(사람이 1회, 브라우저 작업 — 스크립트가 대신할 수 없음)**:
  1. https://console.cloud.google.com 에서 새 프로젝트 생성
  2. "YouTube Data API v3" 활성화
  3. OAuth 동의 화면 구성(외부, 테스트 모드로 충분 — `@MotionLab.coredxi`를 관리하는
     구글 계정을 테스트 사용자로 추가)
  4. OAuth 클라이언트 ID 생성(애플리케이션 유형: 데스크톱 앱) → JSON 다운로드 →
     `secrets/youtube_client_secret.json`으로 저장
  5. `pip install --upgrade google-api-python-client google-auth-oauthlib google-auth-httplib2`
- 이 안내는 스크립트 상단 docstring에도 그대로 남긴다(motiontoon 패턴).
- 테스트 모드에서는 refresh token이 7일 후 만료되어 재인증(브라우저 재실행)이 필요함 —
  motiontoon에서 이미 겪은 제약이라 알고 진행한다. 프로덕션 전환은 Google 검증 절차가 필요해
  개인용 스크립트 규모에는 과함 — 하지 않는다.

## 메타데이터 소스

기존 `<id>_<name>.metadata.txt`를 그대로 파싱한다(신규 JSON 포맷을 만들지 않음 — TS
`metadataDraft.ts`는 손대지 않는다). 포맷:

```
제목: <제목>

설명: <설명>

해시태그: #shorts #모션랩 #자동화영상
```

파싱 규칙:
- `제목:` 다음 줄 → title (100자 초과 시 자름, YouTube 제한)
- `설명:` 다음 줄 → description
- `해시태그:` 다음 줄 → 공백 분리 후 각 토큰의 선행 `#` 제거 → tags 리스트
- 세 블록 중 하나라도 없으면 즉시 에러로 중단(부분 업로드 방지)

## CLI

```
py scripts/youtube_upload.py --project projects/007_xxx [--privacy private|unlisted|public] [--force]
```

- `--project`: 필수. `projects/<id>_<name>` 디렉토리 경로.
- `--privacy`: 기본값 `private`. `unlisted`/`public`은 **사람이 채팅에서 명시적으로 승인한
  경우에만** 이 값으로 실행할 것 — 스크립트는 이 판단을 할 수 없으므로 이 책임은 스크립트를
  실행하는 에이전트(대화 상대)에게 있다(motiontoon과 동일 원칙). 스크립트 자체는 `private` 외
  값으로 실행될 때 경고 메시지만 출력.
- `--force`: 이미 `upload_result.json`이 있어도 재업로드 강행(기본은 차단).
- 업로드는 배포 단계 승인 후 사람이(또는 이를 대행하는 에이전트가) 직접 실행 — render
  파이프라인이나 다른 스크립트에서 자동 트리거하지 않는다.

## 재생목록

- 고정 재생목록 하나: "모션랩 빌드로그"
- `secrets/youtube_playlists.json`에 `{title, id}` 캐시. 캐시에 없으면 채널 재생목록을
  제목으로 검색 → 없으면 새로 생성(privacyStatus: public) → 캐시에 저장.
- 업로드된 영상을 이 재생목록에 추가. 실패해도(권한 문제 등) 업로드 자체는 성공 처리하고
  경고만 출력(motiontoon과 동일 원칙 — 부분 실패로 전체를 실패시키지 않음).

## 중복 방지 / 상태 기록

- 실행 시작 시 `<id>_<name>.upload_result.json` 존재 확인 → 있고 `--force` 없으면 이미
  업로드된 video_id/url을 출력하고 즉시 종료(exit 0, 재업로드 방지).
- 업로드 성공 후 다음 필드를 이 파일에 기록:
  `youtube_video_id`, `youtube_url`, `uploaded_privacy`, `uploaded_at`(UTC ISO8601),
  `playlist_result`(`{playlist_id, added: bool, error?}`).

## 에러 처리

- resumable upload: motiontoon과 동일하게 `HttpError` 500/502/503/504는 지수 백오프
  재시도(최대 10회), 그 외는 즉시 실패.
- 재생목록 추가 실패, 향후 썸네일 실패 등 "업로드 자체는 끝난" 이후 단계의 실패는 전체를
  실패로 처리하지 않고 `upload_result.json`에 실패 내역만 남긴다.
- 필수 파일(mp4, metadata.txt, client_secret.json) 부재 시 사람이 읽을 수 있는 안내와 함께
  즉시 종료.

## 제외 항목 (v1 범위 밖)

- **썸네일 자동 설정**: MotionLab에는 아직 썸네일 후보 이미지 생성 단계가 없음. 필요해지면
  별도 스펙으로.
- **김부장 채널 연결(1단계, 설명란 링크)**: 여전히 미판단 항목, 이 스펙과 무관하게 별도 결정.
- **일괄(batch) 업로드**: 편당 1회 CLI 실행이 기본. 여러 편을 한 번에 올리는 래퍼는 필요성이
  확인되면 나중에 추가.

## 테스트

- 유닛 테스트: `.metadata.txt` 파서(정상 케이스, 블록 누락 시 에러, 해시태그 토큰화)만
  네트워크/인증 없이 검증. 업로드 자체는 실제 YouTube API 호출이라 자동 테스트 대상이 아님 —
  003_pipeline 1편을 `private`로 실제 업로드해보는 것으로 수동 검증.
