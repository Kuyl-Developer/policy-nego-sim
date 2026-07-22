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
    return h("div", { class: cls, style }, h("img", { src: persona.photo, alt: persona.name }));
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
