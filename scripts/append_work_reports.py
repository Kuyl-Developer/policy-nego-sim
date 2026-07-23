# -*- coding: utf-8 -*-
"""정부 업무보고 PDF에서 섹션 단위로 추출한 내용을 collected CSV에 append.
- 산업부(industry) 14개 섹션, 기후부(climate) 16개 섹션.
- csv 모듈로 처리해 excerpt 내 쉼표/따옴표를 안전하게 quoting.
- 실행 후 반드시 `python scripts/build_kb.py` 로 KB 재생성.
"""
import csv
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COLLECTED = os.path.join(ROOT, "data", "collected")
TMP = r"C:\Users\Admin\AppData\Local\Temp\pdfpages"

# build_kb 검증용 TEMPLATE_COLUMNS 순서와 정확히 일치해야 함
COLUMNS = [
    "persona", "source_type", "tier", "title", "org", "author", "date", "url",
    "summary", "excerpt", "priority_axis", "stance_signal", "collector", "verified", "note",
]

CONFIGS = {
    "industry": {
        "csv": "industry.csv",
        "json": "ind_sections.json",
        "persona_label": "산업부",
        "org": "산업통상자원부",
        "date": "2025-12-17",
        "url_prefix": "doc://2026-work-report/industry#s",
    },
    "climate": {
        "csv": "climate.csv",
        "json": "cli_sections.json",
        "persona_label": "기후부",
        "org": "기후에너지환경부",
        "date": "2025-12-17",
        "url_prefix": "doc://2026-work-report/climate#s",
    },
}

NOTE = "정부 업무보고 PDF 섹션 요약(AI 초안, 원문 대조 권장). 페이지 p.{pages}"


def load_sections(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["sections"] if isinstance(data, dict) else data


def existing_urls():
    urls = set()
    for name in ("industry.csv", "climate.csv", "kepco.csv", "kogas.csv"):
        p = os.path.join(COLLECTED, name)
        if not os.path.exists(p):
            continue
        with open(p, "r", encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f):
                u = (row.get("url") or "").strip()
                if u:
                    urls.add(u)
    return urls


def main():
    seen = existing_urls()
    for pid, cfg in CONFIGS.items():
        sections = load_sections(os.path.join(TMP, cfg["json"]))
        csv_path = os.path.join(COLLECTED, cfg["csv"])
        rows = []
        for s in sections:
            n = s["section_no"]
            url = f'{cfg["url_prefix"]}{n}'
            if url in seen:
                raise SystemExit(f"URL 충돌: {url} (이미 존재)")
            seen.add(url)
            pages = ",".join(str(p) for p in s.get("pages", []))
            rows.append({
                "persona": cfg["persona_label"],
                "source_type": "정부 업무보고",
                "tier": "t1",
                "title": f'[2026 업무보고] {s["title"]}',
                "org": cfg["org"],
                "author": "",
                "date": cfg["date"],
                "url": url,
                "summary": s["summary"],
                "excerpt": s["excerpt"],
                "priority_axis": s.get("priority_axis", ""),
                "stance_signal": s.get("stance_signal", ""),
                "collector": "Admin",
                "verified": "Y",
                "note": NOTE.format(pages=pages),
            })
        with open(csv_path, "a", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=COLUMNS, quoting=csv.QUOTE_MINIMAL)
            for r in rows:
                w.writerow(r)
        print(f"{pid}: {len(rows)}개 행 추가 → {csv_path}")


if __name__ == "__main__":
    main()
