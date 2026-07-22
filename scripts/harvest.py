#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
harvest.py — RSS/정책 URL에서 자료 후보를 자동 수집해 수집 템플릿(CSV) 형식으로 정리.

흐름:
  data/sources.csv (수집처 등록)  →  harvest.py  →  data/candidates.csv (템플릿 형식)
                                         │
                                         └─(--summarize) Claude 로 summary/excerpt 초안 자동 작성

수집한 결과는 항상 verified=N(미검수) 로 표시됩니다. 사람이 검수 후
collection-template 의 '승인' 시트/파일로 옮기고 verified=Y 로 바꾸세요.

의존성(팀원 각자 1회 설치):
  pip install feedparser requests
  # --summarize 사용 시 추가:
  pip install anthropic
  export ANTHROPIC_API_KEY=sk-ant-...

사용 예:
  python scripts/harvest.py --sources data/sources.csv --out data/candidates.csv --days 30
  python scripts/harvest.py --summarize            # 요약 초안까지 자동 생성
"""

import argparse
import csv
import html as html_mod
import os
import re
import sys
from datetime import datetime, timezone, timedelta

# 수집 템플릿과 동일한 컬럼 순서 (collection-template.csv 와 반드시 일치)
TEMPLATE_COLUMNS = [
    "persona", "source_type", "tier", "title", "org", "author", "date", "url",
    "summary", "excerpt", "priority_axis", "stance_signal", "collector",
    "verified", "note",
]

# source_type → tier 자동 매핑 (기고·논문·보고서 = t1 …)
TIER_BY_TYPE = {
    "기고": "t1", "논문": "t1", "보고서": "t1",
    "보도자료": "t2",
    "언론기사": "t3", "기사": "t3",
    "인터뷰": "t3",  # 발화 주체에 따라 검수자가 조정
}


def eprint(*a):
    print(*a, file=sys.stderr)


def tier_for(source_type: str) -> str:
    return TIER_BY_TYPE.get((source_type or "").strip(), "t3")


def html_to_text(raw: str) -> str:
    """아주 단순한 HTML → 텍스트 (요약 입력용)."""
    if not raw:
        return ""
    raw = re.sub(r"(?is)<(script|style|noscript).*?>.*?</\1>", " ", raw)
    text = re.sub(r"(?s)<[^>]+>", " ", raw)
    text = html_mod.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def parse_date(entry) -> str:
    """feedparser 엔트리에서 YYYY-MM-DD 추출(실패 시 빈 문자열)."""
    for key in ("published_parsed", "updated_parsed"):
        t = getattr(entry, key, None) or (entry.get(key) if isinstance(entry, dict) else None)
        if t:
            try:
                return datetime(*t[:6]).strftime("%Y-%m-%d")
            except Exception:
                pass
    return ""


def matches_keywords(text: str, keywords: str) -> bool:
    if not keywords:
        return True
    kws = [k.strip().lower() for k in keywords.split("|") if k.strip()]
    if not kws:
        return True
    low = (text or "").lower()
    return any(k in low for k in kws)


def load_sources(path: str):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return [row for row in csv.DictReader(f) if (row.get("active", "Y").strip().upper() != "N")]


def harvest_rss(src: dict, days: int, limit: int):
    """RSS 피드 1개에서 후보 행 목록 생성."""
    try:
        import feedparser  # type: ignore
    except ImportError:
        eprint("‼ feedparser 미설치: pip install feedparser")
        raise

    feed = feedparser.parse(src["url"])
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = []
    for e in feed.entries[: max(limit, 0) or None]:
        title = html_mod.unescape(getattr(e, "title", "") or "")
        link = getattr(e, "link", "") or ""
        date = parse_date(e)
        blob = f"{title} {getattr(e, 'summary', '')}"
        if not matches_keywords(blob, src.get("keywords", "")):
            continue
        if date:
            try:
                if datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc) < cutoff:
                    continue
            except ValueError:
                pass
        rows.append(new_row(src, title=title, url=link, date=date,
                            raw_summary=html_to_text(getattr(e, "summary", ""))))
    return rows


def new_row(src: dict, title="", url="", date="", raw_summary=""):
    st = src.get("source_type", "").strip()
    return {
        "persona": src.get("persona", "").strip(),
        "source_type": st,
        "tier": tier_for(st),
        "title": title.strip(),
        "org": src.get("org", "").strip(),
        "author": "",
        "date": date,
        "url": url.strip(),
        # summary/excerpt 는 검수자 또는 --summarize 가 채움. 우선 피드 요약을 참고용으로 넣어둠.
        "summary": raw_summary[:280],
        "excerpt": "",
        "priority_axis": "",
        "stance_signal": "",
        "collector": "auto:harvest",
        "verified": "N",
        "note": "자동 수집 — 검수 필요(summary·excerpt 확인, tier·priority_axis 보완)",
    }


def summarize_rows(rows, model="claude-opus-4-8"):
    """(선택) Claude 로 summary/excerpt/stance 초안 생성. 원문 페이지를 가볍게 받아 요약."""
    try:
        import requests  # type: ignore
        from anthropic import Anthropic  # type: ignore
    except ImportError:
        eprint("‼ --summarize 에는 pip install requests anthropic 필요")
        return rows
    if not os.getenv("ANTHROPIC_API_KEY"):
        eprint("‼ ANTHROPIC_API_KEY 환경변수가 없습니다. 요약 건너뜀.")
        return rows

    client = Anthropic()
    for r in rows:
        if not r["url"]:
            continue
        try:
            resp = requests.get(r["url"], timeout=15, headers={"User-Agent": "kb-harvest/0.1"})
            article = html_to_text(resp.text)[:6000]
        except Exception as ex:
            eprint(f"  · 본문 수집 실패 {r['url']}: {ex}")
            continue

        prompt = (
            "다음 기사/자료 본문을 읽고 JSON 한 개만 출력하세요. 지어내지 말 것.\n"
            "- summary: 이 자료의 핵심 입장·주장 2~3문장(숫자·날짜 포함).\n"
            "- excerpt: 본문에서 그대로 복사한 핵심 문장 1개(창작·의역 금지).\n"
            '- stance_signal: "우호" | "우려" | "중립" 중 하나.\n\n'
            f"[제목] {r['title']}\n[본문]\n{article}\n\n"
            '출력: {"summary": "...", "excerpt": "...", "stance_signal": "..."}'
        )
        try:
            msg = client.messages.create(
                model=model,
                max_tokens=1200,
                thinking={"type": "adaptive"},
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
            data = _extract_json(text)
            if data.get("summary"):
                r["summary"] = data["summary"].strip()
            if data.get("excerpt"):
                r["excerpt"] = data["excerpt"].strip()
            if data.get("stance_signal"):
                r["stance_signal"] = data["stance_signal"].strip()
            r["note"] = "자동 수집+요약 초안 — 반드시 검수(excerpt 원문 대조)"
        except Exception as ex:
            eprint(f"  · 요약 실패 {r['url']}: {ex}")
    return rows


def _extract_json(text: str) -> dict:
    import json
    s = text.strip().strip("`")
    a, b = s.find("{"), s.rfind("}")
    if a == -1 or b == -1:
        return {}
    try:
        return json.loads(s[a:b + 1])
    except Exception:
        return {}


def main():
    ap = argparse.ArgumentParser(description="RSS/URL 자료 자동 수집 → 수집 템플릿 CSV")
    ap.add_argument("--sources", default="data/sources.csv", help="수집처 등록 CSV")
    ap.add_argument("--out", default="data/candidates.csv", help="출력 후보 CSV")
    ap.add_argument("--days", type=int, default=30, help="최근 N일 이내 자료만")
    ap.add_argument("--limit", type=int, default=20, help="소스당 최대 건수")
    ap.add_argument("--summarize", action="store_true", help="Claude 로 summary/excerpt 초안 생성")
    args = ap.parse_args()

    if not os.path.exists(args.sources):
        eprint(f"수집처 파일 없음: {args.sources} (data/sources.example.csv 참고해 만드세요)")
        sys.exit(1)

    sources = load_sources(args.sources)
    all_rows = []
    for src in sources:
        ftype = (src.get("feed_type") or "").strip().lower()
        label = f"[{src.get('persona')}] {src.get('org')} ({ftype})"
        if ftype == "rss":
            try:
                rows = harvest_rss(src, args.days, args.limit)
                eprint(f"✓ {label}: {len(rows)}건")
                all_rows.extend(rows)
            except Exception as ex:
                eprint(f"✗ {label}: {ex}")
        elif ftype == "html":
            # 정책자료 페이지는 사이트마다 구조가 달라 전용 파서가 필요.
            # 여기서는 스켈레톤 행 1개만 남겨 '수동 확인 필요'로 표시.
            eprint(f"… {label}: html 소스는 사이트별 파서 필요 — 수동 확인 대상으로 표시")
            row = new_row(src)
            row["note"] = f"html 소스({src.get('url')}) — RSS 유무 확인 또는 전용 파서 필요"
            all_rows.append(row)
        else:
            eprint(f"? {label}: 알 수 없는 feed_type '{ftype}' (rss/html)")

    # URL 기준 중복 제거
    seen, deduped = set(), []
    for r in all_rows:
        key = r["url"] or (r["title"] + r["persona"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)

    if args.summarize:
        eprint(f"요약 초안 생성 중… ({len(deduped)}건)")
        deduped = summarize_rows(deduped)

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=TEMPLATE_COLUMNS)
        w.writeheader()
        w.writerows(deduped)

    eprint(f"\n완료: {len(deduped)}건 → {args.out}")
    eprint("다음 단계: 사람이 summary·excerpt·tier·priority_axis 검수 후 verified=Y 로 승격")


if __name__ == "__main__":
    main()
