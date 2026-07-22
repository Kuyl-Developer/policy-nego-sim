# 10조 Git Policy

## 1. 브랜치 전략 (Git Flow)

### 메인 브랜치
- **`main`** - 프로덕션 배포 가능한 상태 (항상 안정적)
- **`develop`** - 개발 통합 브랜치

### 피처 브랜치
- 규칙: `feature/{작업명}` 또는 `bugfix/{버그명}`
- 예시: `feature/persona-chat`, `bugfix/api-error-handling`
- **반드시 `develop`에서 생성**
- 작업 완료 후 PR을 통해 `develop`으로 머지

### 릴리스/핫픽스
- `release/{버전}` - 릴리스 준비 브랜치
- `hotfix/{버그명}` - main에서 긴급 수정 (완료 후 main/develop 모두 머지)

---

## 2. 커밋 메시지 규칙

### 형식
```
[타입] 제목

본문 (선택)
```

### 타입
- **feat**: 새로운 기능 추가
- **fix**: 버그 수정
- **refactor**: 코드 구조 개선 (기능 변경 없음)
- **style**: 포맷, 세미콜론 등 코드 스타일 (로직 변경 없음)
- **docs**: 문서 수정 (README, 코멘트 등)
- **test**: 테스트 코드 추가/수정
- **chore**: 빌드, 패키지 매니저, 의존성 등 (프로덕션 코드 변경 없음)

### 제목 규칙
- 한글 또는 영어로 간결하게 (50자 이내 권장)
- 마침표 없음
- 명령형 현재형 사용 ("추가한다" X → "추가" O)
- 대문자로 시작

### 예시
```
[feat] 페르소나 다자 채팅 기능 추가

- Claude API 연동으로 동적 반응 생성
- 근거 출처 자동 인용 기능 구현
```

```
[fix] 모바일 화면에서 말풍선 레이아웃 깨짐

반응형 너비 조정으로 작은 화면에서도 가독성 확보
```

---

## 3. PR(Pull Request) & 코드 리뷰 프로세스

### PR 생성 규칙
1. **기능 완성 후** feature 브랜치에서 `develop`으로 PR 생성
2. **PR 제목**: `[타입] 제목` (커밋 메시지 규칙과 동일)
3. **PR 본문**: 
   - 변경 사항 요약
   - 테스트한 내용
   - 관련 이슈/논의 (있으면)

### 예시 PR 본문
```markdown
## 변경 사항
- 페르소나 채팅 API 응답 시간 개선
- 오류 처리 로직 보완

## 테스트
- [x] 로컬 서버에서 정상 동작 확인
- [x] 모든 페르소나 응답 검증

## 참고
관련 이슈: #12
```

### 코드 리뷰 체크리스트
- [ ] 커밋 메시지가 명확한가?
- [ ] 코드가 읽기 쉬운가? (네이밍, 구조)
- [ ] 테스트를 거쳤는가?
- [ ] 문서를 업데이트했는가?

### 리뷰 후 머지 (최소 1명 승인)
- PR 승인 후 `develop`으로 머지
- 불필요한 머지 커밋 방지를 위해 **Squash and merge** 권장
- 머지 후 로컬 브랜치 삭제

---

## 4. 머지 전략

### Develop로 머지 (기능 통합)
```bash
# 1. PR 검토 및 승인
# 2. GitHub UI에서 "Squash and merge" 선택
# 또는 커맨드라인에서:
git checkout develop
git pull origin develop
git merge --squash feature/your-feature
git commit -m "[feat] 기능 설명"
git push origin develop
```

### Main으로 머지 (릴리스)
- **develop에서 충분히 검증된 코드만** main으로 머지
- `release/` 브랜치를 거치는 것을 권장
- 버전 태그 추가: `git tag v1.0.0`

```bash
git checkout main
git pull origin main
git merge --no-ff develop -m "[release] v1.0.0"
git tag v1.0.0
git push origin main --tags
```

---

## 5. 일상 워크플로우

### 새로운 기능 작업
```bash
# 1. develop 최신화
git checkout develop
git pull origin develop

# 2. feature 브랜치 생성
git checkout -b feature/persona-chat

# 3. 작업 후 커밋
git add .
git commit -m "[feat] 페르소나 채팅 기능"

# 4. Push
git push origin feature/persona-chat

# 5. GitHub에서 PR 생성 (develop으로)

# 6. 리뷰 후 승인 → 머지
# 7. 로컬 정리
git checkout develop
git pull origin develop
git branch -d feature/persona-chat
```

### 버그 수정
```bash
git checkout develop
git pull origin develop
git checkout -b bugfix/api-error

# ... 수정 작업 ...

git add .
git commit -m "[fix] API 에러 핸들링 개선"
git push origin bugfix/api-error

# GitHub에서 PR 생성 (develop으로)
```

---

## 6. 주의사항

- ⚠️ **main 브랜치에 직접 push 금지** (항상 PR을 통해 진행)
- ⚠️ **커밋 전에 `git status` 확인** (의도하지 않은 파일이 포함되지 않았는지)
- ⚠️ **민감한 정보(API 키, 패스워드) 커밋 금지** (.gitignore 확인)
- ⚠️ **오래된 커밋 수정(amend, rebase) 후 강제 push 금지** (협업 시 문제 발생)

---

## 7. 예상 질문 (FAQ)

**Q: 작은 버그 수정도 PR을 통해야 하나?**  
A: 네. 한 줄의 수정도 코드 리뷰를 통해 품질 관리를 유지합니다.

**Q: 머지 전략에서 "Squash"와 "Rebase"의 차이는?**  
- **Squash**: 여러 커밋을 1개로 통합 (히스토리 간결) → 권장
- **Rebase**: 선형 히스토리 유지 (복잡할 수 있음)

**Q: Develop에 PR할 때 Conflict가 나면?**  
A: 로컬에서 develop을 pull 받아 conflict 해결 후 push. 강제로 덮어쓰지 말 것.

---

## 8. 버전 관리

- **태그 형식**: `v{major}.{minor}.{patch}`
- **예시**: `v1.0.0`, `v1.0.1`, `v2.1.0`
- main 브랜치에서만 태그 생성

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

**마지막 업데이트**: 2026-07-22  
**승인**: 10조 전원
