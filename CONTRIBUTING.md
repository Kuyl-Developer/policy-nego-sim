# 공동작업 가이드 (5인 팀)

E&S 커뮤니케이션 시뮬레이터를 여러 명이 함께 만들 때의 역할·워크플로·규칙입니다.
데이터 자체의 작성 규칙은 [데이터 수집 가이드](docs/데이터수집가이드.md)를 보세요. 이 문서는 **"어떻게 나눠 작업하고 GitHub에 올리는가"** 를 다룹니다.

---

## 1. 역할 분담 (5명)

| 역할 | 인원 | 담당 파일 | 하는 일 |
|---|---|---|---|
| 페르소나 오너 ×4 | 4명 | `data/collected/climate.csv` 등 **각자 1개** | 담당 페르소나 자료 수집·검수·`verified=Y` 표시 |
| 메인테이너 | 1명(오너 겸임 가능) | `scripts/`, `src/`, 생성물 | 수집처 관리·`build_kb.py` 실행·생성물 커밋·PR 병합 |

- 기후부 → `data/collected/climate.csv`
- 산업부 → `data/collected/industry.csv`
- 한전 → `data/collected/kepco.csv`
- 가스공사 → `data/collected/kogas.csv`

> **핵심 원칙: "한 사람 = 한 파일".** 각자 자기 페르소나 CSV만 편집하면 서로 다른 파일을 건드리므로 **병합 충돌이 나지 않습니다.**

---

## 2. 최초 1회 세팅

메인테이너가 GitHub 저장소에서:
1. **Settings → Collaborators** 에서 팀원 4명을 초대 (또는 조직 팀 부여).
2. **Settings → Branches → Branch protection rule** 로 `main` 보호:
   - "Require a pull request before merging" 켜기 (직접 push 금지)
   - 리뷰 1명 승인 요구(권장)

팀원 각자(최초 1회):
```bash
git clone https://github.com/<org-or-user>/policy-nego-sim.git
cd policy-nego-sim
git config user.name "본인이름"
git config user.email "본인이메일"
```

---

## 3. 일상 작업 흐름 (매번)

```bash
# 1) 최신 main 받기
git switch main
git pull origin main

# 2) 작업 브랜치 만들기 (형식: data/<persona>-<날짜> 또는 feat/<주제>)
git switch -c data/climate-0722

# 3) 담당 파일만 편집 (data/collected/<persona>.csv)
#    - 자동 수집을 쓰면: python scripts/harvest.py 로 후보 생성 → 검수 후 CSV에 반영

# 4) 커밋 & 푸시
git add data/collected/climate.csv
git commit -m "기후부 자료 8건 추가(검수 완료)"
git push -u origin data/climate-0722
```

4) GitHub에서 **Pull Request** 생성 → PR 템플릿 체크리스트 작성 → 리뷰 요청.
5) 리뷰 승인 후 **Squash and merge** → 브랜치 삭제.

> **브랜치 이름 규칙**: 데이터는 `data/<persona>-<MMDD>`, 기능은 `feat/<주제>`, 버그는 `fix/<주제>`.

---

## 4. 데이터 → 앱 반영 (메인테이너 전용)

수집 CSV는 사람이 읽는 원본이고, 앱은 **생성물**(`src/data/knowledgeBase.data.js`)을 씁니다.
데이터 PR들이 병합된 뒤, 메인테이너가 변환합니다.

```bash
git switch main && git pull origin main

# 검증만 (쓰기 없음) — PR 리뷰 때도 사용
python scripts/build_kb.py --check

# 실제 생성물 재빌드
python scripts/build_kb.py

git add src/data/knowledgeBase.data.js data/knowledgeBase.json
git commit -m "지식 베이스 재빌드(build_kb)"
git push origin main   # 또는 별도 PR
```

- `build_kb.py`는 **`verified=Y` 인 행만** 반영합니다.
- **검증 통과 행이 0건이면 아무것도 덮어쓰지 않습니다.** (수집 전 실수 실행해도 샘플 데이터가 보존됨)
- `id`는 빌드가 `kb-<persona>-<순번>`으로 **자동 부여**합니다. CSV에 직접 쓰지 마세요.
- 생성물(`.data.js`/`.json`)은 **손으로 편집하지 말고** 항상 `build_kb.py`로만 갱신하세요.

---

## 5. 하지 말아야 할 것

- ❌ `main`에 직접 push (항상 브랜치 + PR)
- ❌ 남의 페르소나 CSV 편집 (충돌 유발)
- ❌ 생성물(`knowledgeBase.data.js`/`.json`) 직접 편집
- ❌ **API 키·비밀정보 커밋** — `.env`/`*.key`는 `.gitignore` 처리됨. 앱의 브라우저 키 입력은 데모용이며 저장소에 넣지 않습니다.
- ❌ 비공개·내부 미승인 정보를 자료로 추가

---

## 6. 로컬 실행 (개발/데모)

ES 모듈이라 `file://`로 열면 안 되고 **HTTP 서버**로 띄워야 합니다.

```bash
python -m http.server 5173
# 브라우저에서 http://localhost:5173 접속
```

배포는 GitHub Pages(정적 호스팅)로 가능합니다. (Settings → Pages)
