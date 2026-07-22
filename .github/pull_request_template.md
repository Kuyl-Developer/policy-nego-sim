## 무엇을 바꿨나요
<!-- 한 줄 요약: 어떤 페르소나/어떤 자료를 추가·수정했는지 -->

- 페르소나:  <!-- 기후부 / 산업부 / 한전 / 가스공사 / (앱 코드) -->
- 추가·수정 자료 건수:

## 변경 유형
- [ ] 데이터 수집 (`data/collected/<persona>.csv`)
- [ ] 수집처 등록 (`data/sources.csv`)
- [ ] 앱 코드 (`src/`, `index.html`, `styles/`)
- [ ] 생성물 재빌드 (`knowledgeBase.data.js` / `.json`) — 메인테이너만
- [ ] 문서

## 데이터 검수 체크리스트 (자료를 추가·수정한 경우 필수)
> 자세한 규칙은 [데이터 수집 가이드](../docs/데이터수집가이드.md) 참고

- [ ] 담당 페르소나 파일(`data/collected/<persona>.csv`)만 수정했다 (충돌 방지)
- [ ] 필수 컬럼(persona/source_type/tier/title/org/date/url/summary/excerpt/priority_axis/collector/verified)을 모두 채웠다
- [ ] `date`가 `YYYY-MM-DD` 형식이다
- [ ] `summary`가 "제목 요약"이 아니라 **그 자료의 입장**이다 (숫자·날짜 포함, 2~3문장)
- [ ] `excerpt`가 **원문 그대로**의 직접 인용이다 (의역·창작 없음)
- [ ] **공개·승인된 자료만** 사용했다 (비공개·내부 미승인 정보 없음)
- [ ] URL이 접속되고, 기존 자료와 **중복되지 않는다**
- [ ] 검수를 마친 행만 `verified=Y` 로 표시했다
- [ ] `id`는 직접 만들지 않았다 (빌드 단계에서 자동 부여)

## 검증 실행 결과
```
python scripts/build_kb.py --check
```
<!-- 위 명령 출력(통과/실패 건수)을 붙여넣어 주세요. 실패가 없어야 병합 가능합니다. -->

## 비고
<!-- 추정·한계, 리뷰어에게 남길 말 등 -->
