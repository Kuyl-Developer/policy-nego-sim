#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_kb.py — 페르소나별 수집 CSV를 병합·검증해 앱의 지식 베이스로 변환.

흐름:
  data/collected/{climate,industry,kepco,kogas}.csv   (페르소나 오너가 관리)
        │  (verified=Y 인 행만)
        ▼
  검증(필수값·날짜형식·tier·URL중복) → id 자동 부여
        ▼
  src/data/knowledgeBase.data.js   (앱이 바로 import — file:// / Pages 에서도 동작)
  data/knowledgeBase.json          (이식용 아티팩트)

원칙:
  - verified=Y 인 행만 반영합니다. (미검수 자료는 앱에 들어가지 않음)
  - 검증 통과 행이 0건이면 아무것도 덮어쓰지 않고 중단합니다.
    → 수집 전 실수로 실행해도 기존 샘플 데이터가 지워지지 않습니다.
  - 보통 '메인테이너 1명'만 실행하고 생성물(.data.js/.json)을 커밋합니다.

사용:
  python scripts/build_kb.py
  python scripts/build_kb.py --dir data/collected --check   # 검증만(쓰기 없음)
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime

# 파일명(스템) → personaId, 그리고 CSV persona 컬럼에 기대되는 한글 라벨
PERSONA_LABEL = {
    "climate": "기후부",
    "industry": "산업부",
    "kepco": "한전",
    "kogas": "가스공사",
}
VALID_TIERS = {"t1", "t2", "t3"}
# collection-template.csv 와 동일한 컬럼 순서
TEMPLATE_COLUMNS = [
    "persona", "source_type", "tier", "title", "org", "author", "date", "url",
    "summary", "excerpt", "priority_axis", "stance_signal", "collector",
    "verified", "note",
]
# 앱 항목이 반드시 갖춰야 하는 값(검수 완료 행 기준)
REQUIRED = ["source_type", "tier", "title", "org", "date", "url", "summary",
            "excerpt", "priority_axis", "collector"]

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DIR = os.path.join(REPO, "data", "collected")
OUT_JS = os.path.join(REPO, "src", "data", "knowledgeBase.data.js")
OUT_JSON = os.path.join(REPO, "data", "knowledgeBase.json")


def eprint(*a):
    print(*a, file=sys.stderr)


def is_yes(v: str) -> bool:
    return (v or "").strip().upper() in ("Y", "YES", "TRUE", "1")


def valid_date(v: str) -> bool:
    try:
        datetime.strptime((v or "").strip(), "%Y-%m-%d")
        return True
    except ValueError:
        return False


def load_persona(persona_id: str, path: str, errors: list):
    """한 페르소나 CSV에서 verified=Y & 검증 통과 행만 반환."""
    if not os.path.exists(path):
        eprint(f"… {persona_id}: 파일 없음({path}) — 건너뜀")
        return []
    rows = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        missing_cols = [c for c in TEMPLATE_COLUMNS if c not in (reader.fieldnames or [])]
        if missing_cols:
            errors.append(f"{persona_id}.csv: 헤더 누락 {missing_cols}")
            return []
        for i, row in enumerate(reader, start=2):  # 2 = 헤더 다음 첫 데이터 행
            if not is_yes(row.get("verified", "")):
                continue  # 미검수 자료는 조용히 제외
            loc = f"{persona_id}.csv:{i}"
            # 필수값
            for col in REQUIRED:
                if not (row.get(col) or "").strip():
                    errors.append(f"{loc}: 필수값 '{col}' 비어 있음")
            # 페르소나 라벨 정합성
            label = (row.get("persona") or "").strip()
            if label and label != PERSONA_LABEL[persona_id]:
                errors.append(
                    f"{loc}: persona '{label}' 가 파일({persona_id}={PERSONA_LABEL[persona_id]})과 불일치")
            # tier / date 형식
            tier = (row.get("tier") or "").strip()
            if tier not in VALID_TIERS:
                errors.append(f"{loc}: tier '{tier}' 는 t1/t2/t3 중 하나여야 함")
            if not valid_date(row.get("date", "")):
                errors.append(f"{loc}: date '{row.get('date')}' 형식 오류(YYYY-MM-DD)")
            rows.append((loc, persona_id, row))
    return rows


def to_entry(persona_id: str, seq: int, row: dict) -> dict:
    """검증 통과 행 → 앱 지식 베이스 항목."""
    return {
        "id": f"kb-{persona_id}-{seq}",
        "personaId": persona_id,
        "title": row["title"].strip(),
        "org": row["org"].strip(),
        "date": row["date"].strip(),
        "url": row["url"].strip(),
        "tier": row["tier"].strip(),
        "summary": row["summary"].strip(),
        # 원문 직접 인용 — 향후 인용칩/근거 강화를 위해 함께 보관(앱은 현재 summary만 사용)
        "excerpt": (row.get("excerpt") or "").strip(),
        "sample": False,
    }


def write_outputs(entries: list):
    banner = (
        "// ⚙️ 생성물(GENERATED) — scripts/build_kb.py 가 자동 생성합니다. 직접 편집 금지.\n"
        "// 데이터는 data/collected/<persona>.csv 에서 관리하고 build_kb.py 를 다시 실행하세요.\n\n"
        "export const KNOWLEDGE_BASE = [\n"
    )
    lines = []
    for e in entries:
        lines.append("  " + json.dumps(e, ensure_ascii=False) + ",")
    body = banner + "\n".join(lines) + "\n];\n"
    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    with open(OUT_JS, "w", encoding="utf-8", newline="\n") as f:
        f.write(body)
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8", newline="\n") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
    eprint(f"✓ 생성: {os.path.relpath(OUT_JS, REPO)} ({len(entries)}건)")
    eprint(f"✓ 생성: {os.path.relpath(OUT_JSON, REPO)}")


def main():
    ap = argparse.ArgumentParser(description="페르소나 수집 CSV → 지식 베이스 변환")
    ap.add_argument("--dir", default=DEFAULT_DIR, help="수집 CSV 폴더")
    ap.add_argument("--check", action="store_true", help="검증만 수행(파일 쓰기 없음)")
    args = ap.parse_args()

    errors = []
    all_rows = []
    for persona_id in PERSONA_LABEL:  # climate, industry, kepco, kogas
        path = os.path.join(args.dir, f"{persona_id}.csv")
        all_rows.extend(load_persona(persona_id, path, errors))

    # URL 전역 중복 검사
    seen = {}
    for loc, _pid, row in all_rows:
        url = (row.get("url") or "").strip()
        if not url:
            continue
        if url in seen:
            errors.append(f"{loc}: URL 중복 (이미 {seen[url]} 에 있음) — {url}")
        else:
            seen[url] = loc

    if errors:
        eprint(f"\n✗ 검증 실패 {len(errors)}건:")
        for msg in errors:
            eprint(f"  · {msg}")
        eprint("\n오류를 고친 뒤 다시 실행하세요. (아무것도 덮어쓰지 않았습니다.)")
        sys.exit(1)

    if not all_rows:
        eprint("\n⚠ verified=Y 인 검증 통과 행이 0건입니다.")
        eprint("  기존 지식 베이스(샘플 포함)를 보존하기 위해 아무것도 덮어쓰지 않고 종료합니다.")
        eprint("  data/collected/<persona>.csv 를 채우고 verified=Y 로 표시한 뒤 다시 실행하세요.")
        sys.exit(2)

    # 페르소나별 seq 부여(입력 순서 유지)
    entries, counter = [], {}
    for _loc, persona_id, row in all_rows:
        counter[persona_id] = counter.get(persona_id, 0) + 1
        entries.append(to_entry(persona_id, counter[persona_id], row))

    per = ", ".join(f"{PERSONA_LABEL[p]} {counter.get(p, 0)}" for p in PERSONA_LABEL)
    eprint(f"검증 통과: 총 {len(entries)}건 ({per})")

    if args.check:
        eprint("✓ --check: 검증만 완료(파일 쓰기 없음)")
        return

    write_outputs(entries)
    eprint("완료. 생성물(knowledgeBase.data.js / knowledgeBase.json)을 커밋하세요.")


if __name__ == "__main__":
    main()
