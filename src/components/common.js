// 공용 UI 컴포넌트

import { h } from "../lib/dom.js";
import { KB_BY_ID, TIER_LABEL } from "../data/knowledgeBase.js";

// 페르소나 강조색을 CSS 변수로 내려주는 style 객체
export function accentVars(persona) {
  return { "--accent": persona.accent, "--accent-bg": persona.accentBg };
}

// 인물 사진 아이콘(아바타). photo 가 있으면 이미지, 없으면 이모지 플레이스홀더.
export function avatar(persona, { sm = false } = {}) {
  const cls = "avatar" + (sm ? " avatar--sm" : "");
  const style = accentVars(persona);
  if (persona.photo) {
    // 이미지 로드 실패(파일 미배치 등) 시 이모지 플레이스홀더로 자동 폴백
    const img = h("img", {
      src: persona.photo,
      alt: persona.name,
      onError: (e) => {
        const box = e.target.parentNode;
        if (box) {
          box.removeChild(e.target);
          box.textContent = persona.emoji;
        }
      },
    });
    return h("div", { class: cls, style }, img);
  }
  return h("div", { class: cls, style }, persona.emoji);
}

const STANCE_LABEL = {
  support: "찬성",
  conditional: "조건부",
  concern: "우려",
};

export function stanceBadge(stance) {
  return h("span", { class: `stance stance--${stance}` }, STANCE_LABEL[stance] || "검토");
}

// 수용도 변화 뱃지 — 이번 응답의 수용도가 직전 응답 대비 얼마나 오르내렸는지 표시.
// prev 가 없으면(해당 페르소나의 첫 응답) '첫 평가'로 표기한다.
export function acceptabilityChange(current, prev) {
  if (!Number.isFinite(current)) return null;
  const hasPrev = Number.isFinite(prev);
  const diff = hasPrev ? current - prev : 0;
  const dir = !hasPrev ? "first" : diff > 0 ? "up" : diff < 0 ? "down" : "same";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "—";
  return h(
    "div",
    { class: `acc-change acc-change--${dir}`, title: "직전 응답 대비 수용도 변화" },
    h("span", { class: "acc-change__label" }, "수용도"),
    hasPrev ? h("span", { class: "acc-change__prev" }, `${prev}%`) : null,
    hasPrev ? h("span", { class: "acc-change__to" }, "→") : null,
    h("span", { class: "acc-change__cur" }, `${current}%`),
    h(
      "span",
      { class: "acc-change__diff" },
      hasPrev ? `${arrow} ${Math.abs(diff)}%p` : "첫 평가"
    )
  );
}

// 근거(출처) 칩 목록 — 제목 칩 + 링크 + 신뢰도 티어
export function citationChips(citationIds) {
  const chips = (citationIds || [])
    .map((id) => KB_BY_ID[id])
    .filter(Boolean)
    .map((s) =>
      h(
        "a",
        { class: "cite", href: s.url || "#", target: s.url && s.url !== "#" ? "_blank" : null, rel: "noopener", title: s.summary },
        h("span", { class: `cite__tier cite__tier--${s.tier}` }, TIER_LABEL[s.tier]),
        h("span", {}, `${s.date} · ${s.title} 인용`)
      )
    );
  return h("div", { class: "cites" }, chips);
}
