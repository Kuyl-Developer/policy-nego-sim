// 화면 ② 다자 채팅형 모의 협상 (라운드테이블)
// 사용자가 발언하면 선택한 이해관계자 전원이 각자 입장에서 대응한다.
// 페르소나별 실시간 수용도 미터로 설득 진척을 보여준다.

import { h } from "../lib/dom.js";
import { getState } from "../lib/store.js";
import { PERSONA_BY_ID } from "../data/personas.js";
import { avatar, accentVars, stanceBadge, citationChips } from "../components/common.js";
import { goToSelect, endNegotiation, sendMessage, setChatInput } from "../actions.js";
import { isLiveMode } from "../lib/anthropic.js";

// 상단: 페르소나별 실시간 수용도 미터
function meterStrip(selectedIds, acceptability, lastStance) {
  const rows = selectedIds.map((id) => {
    const p = PERSONA_BY_ID[id];
    const acc = acceptability[id];
    const has = Number.isFinite(acc);
    return h(
      "div",
      { class: "nego-meter", style: accentVars(p) },
      avatar(p, { sm: true }),
      h(
        "div",
        { class: "nego-meter__main" },
        h(
          "div",
          { class: "nego-meter__top" },
          h("span", { class: "nego-meter__name" }, p.name),
          lastStance[id] ? stanceBadge(lastStance[id]) : null,
          h("span", { class: "nego-meter__pct" }, has ? `${acc}%` : "—")
        ),
        h(
          "div",
          { class: "bar" },
          h("div", { class: "bar__fill", style: { width: `${has ? acc : 0}%` } })
        )
      )
    );
  });
  return h(
    "div",
    { class: "card nego-meters" },
    h("div", { class: "block-label" }, "실시간 수용도 · Persuasion meter"),
    h("div", { class: "nego-meters__grid" }, rows)
  );
}

function userBubble(m) {
  return h(
    "div",
    { class: "chat-msg chat-msg--user fade-in" },
    h(
      "div",
      { class: "chat-msg__body" },
      h(
        "div",
        { class: "bubble bubble--user" },
        h("div", { class: "bubble__head bubble__head--user" }, h("span", { class: "bubble__name" }, "우리 측 (제안자)")),
        h("p", { class: "bubble__summary bubble__summary--user" }, m.text)
      )
    )
  );
}

function personaBubble(m) {
  const persona = PERSONA_BY_ID[m.personaId];
  const body = [
    h(
      "div",
      { class: "bubble__head" },
      h("span", { class: "bubble__name" }, persona.name),
      h("span", { class: "bubble__role" }, persona.org),
      stanceBadge(m.stance),
      m.source === "seed" ? h("span", { class: "seed-tag" }, "시드 미리보기") : null
    ),
    h("p", { class: "bubble__summary" }, m.text),
  ];

  if (m.concerns && m.concerns.length) {
    body.push(h("div", { class: "block-label" }, "남은 우려 · Concern"));
    body.push(h("ul", { class: "risk-list" }, m.concerns.map((x) => h("li", {}, x))));
  }
  if (m.citationIds && m.citationIds.length) {
    body.push(h("div", { class: "block-label" }, "근거 · Evidence"));
    body.push(citationChips(m.citationIds));
  }
  if (m.limitation) {
    body.push(
      h("div", { class: "limitation" }, h("b", {}, "공개자료 기반 추정·한계 — "), m.limitation)
    );
  }

  return h(
    "div",
    { class: "chat-msg fade-in" },
    avatar(persona),
    h("div", { class: "chat-msg__body" }, h("div", { class: "bubble", style: accentVars(persona) }, body))
  );
}

function typingBubble(persona) {
  return h(
    "div",
    { class: "chat-msg" },
    avatar(persona),
    h(
      "div",
      { class: "chat-msg__body" },
      h(
        "div",
        { class: "bubble", style: accentVars(persona) },
        h(
          "div",
          { class: "bubble__head" },
          h("span", { class: "bubble__name" }, persona.name),
          h("span", { class: "bubble__role" }, persona.org)
        ),
        h("div", { class: "typing" }, h("span", {}), h("span", {}), h("span", {}))
      )
    )
  );
}

export function renderChatScreen() {
  const { selectedIds, messages, acceptability, negotiating, pendingIds, round, chatInput } = getState();
  const live = isLiveMode();

  // 페르소나별 마지막 입장(stance)
  const lastStance = {};
  for (const m of messages) if (m.role === "persona") lastStance[m.personaId] = m.stance;

  const head = h(
    "div",
    { class: "screen-head" },
    h("div", { class: "eyebrow" }, "STEP 2 · 모의 협상 (라운드테이블)"),
    h("h1", {}, "이해관계자와 협상하기"),
    h(
      "p",
      {},
      "당신의 발언에 선택한 이해관계자 전원이 각자 입장에서 대응합니다. 논리와 근거로 설득해 수용도를 끌어올리세요."
    )
  );

  const meters = meterStrip(selectedIds, acceptability, lastStance);

  // 대화 로그
  const items = messages.map((m) => (m.role === "user" ? userBubble(m) : personaBubble(m)));
  // 이번 라운드에서 아직 답변 전인 페르소나의 타이핑 표시
  if (negotiating) {
    for (const id of pendingIds) items.push(typingBubble(PERSONA_BY_ID[id]));
  }
  const log = h("div", { class: "nego-log" }, items);
  // 렌더 후 항상 맨 아래로 스크롤
  queueMicrotask(() => {
    log.scrollTop = log.scrollHeight;
  });

  // 입력창
  const input = h("textarea", {
    class: "composer__input",
    rows: "2",
    placeholder: !live
      ? "API 키를 입력하면 대화를 이어갈 수 있습니다."
      : negotiating
      ? "이해관계자들이 응답 중입니다…"
      : "우리 측 논리를 입력해 설득하세요. (Enter 전송 · Shift+Enter 줄바꿈)",
    disabled: !live || negotiating,
    value: chatInput || "",
    oninput: (e) => setChatInput(e.target.value),
    onkeydown: (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const v = e.target.value;
        setChatInput("");
        e.target.value = "";
        sendMessage(v);
      }
    },
  });

  const sendBtn = h(
    "button",
    {
      class: "btn btn--primary",
      disabled: !live || negotiating,
      onClick: () => {
        const v = input.value;
        setChatInput("");
        input.value = "";
        sendMessage(v);
      },
    },
    negotiating ? "응답 대기…" : "보내기"
  );

  const composer = h("div", { class: "composer" }, input, sendBtn);

  // 응답 완료 후 입력창에 포커스(라이브·대기중 아님)
  if (live && !negotiating) {
    queueMicrotask(() => input.focus());
  }

  const anyReply = messages.some((m) => m.role === "persona");
  const toolbar = h(
    "div",
    { class: "toolbar toolbar--between" },
    h("button", { class: "btn btn--ghost", disabled: negotiating, onClick: () => goToSelect() }, "← 다시 선택"),
    h(
      "div",
      { class: "mode-note" },
      `${round}라운드 진행 · ${selectedIds.length}명 참여`
    ),
    h(
      "button",
      { class: "btn btn--primary btn--lg", disabled: !anyReply || negotiating, onClick: () => endNegotiation() },
      "협상 종료 · 리포트 보기 →"
    )
  );

  return h("div", { class: "fade-in" }, head, meters, log, composer, toolbar);
}
