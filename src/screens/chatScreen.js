// 화면 ② 다자 채팅형 모의 협상 (라운드테이블)
// 사용자가 발언하면 선택한 이해관계자 전원이 각자 입장에서 대응한다.
// 페르소나별 실시간 수용도 미터로 설득 진척을 보여준다.

import { h } from "../lib/dom.js";
import { getState } from "../lib/store.js";
import { PERSONAS, PERSONA_BY_ID } from "../data/personas.js";
import { avatar, accentVars, stanceBadge, citationChips, acceptabilityChange } from "../components/common.js";
import { goToSelect, endNegotiation, sendMessage, setChatInput, invitePersona } from "../actions.js";
import { isLiveMode } from "../lib/anthropic.js";

// 수용도 구간별 색조(낮음=경고/보통/높음). fill 색상을 값에 따라 바꿔 진척을 직관화한다.
function accLevel(acc) {
  if (acc >= 67) return "high";
  if (acc >= 34) return "mid";
  return "low";
}

// 미참여 페르소나를 테이블로 초대하는 행. 도중에 제3자를 불러 직접 입장을 듣는다.
function inviteRow(selectedIds, negotiating) {
  const others = PERSONAS.filter((p) => !selectedIds.includes(p.id));
  if (others.length === 0) return null; // 전원 참여 중이면 미표시
  const chips = others.map((p) =>
    h(
      "button",
      {
        class: "invite-chip",
        style: accentVars(p),
        disabled: negotiating,
        title: `${p.name} (${p.org}) 초대`,
        onClick: () => invitePersona(p.id),
      },
      avatar(p, { sm: true }),
      h("span", { class: "invite-chip__name" }, p.name),
      h("span", { class: "invite-chip__plus" }, "+")
    )
  );
  return h(
    "div",
    { class: "nego-invite" },
    h("span", { class: "nego-invite__label" }, "테이블로 초대"),
    h("div", { class: "nego-invite__chips" }, chips)
  );
}

// 협상 합류 등 중앙 정렬 시스템 안내
function systemNote(m) {
  return h("div", { class: "sys-note-row" }, h("span", { class: "sys-note" }, m.text));
}

// 라운드 사이 변화(▲/▼)를 보여주기 위한 "이번 라운드 시작 시점" 수용도 스냅샷.
// runRound()가 페르소나 응답을 받는 대로 하나씩 반영해 라운드 중 여러 번 리렌더되므로,
// 렌더마다 직전 값을 갱신하면 변화량이 다음 리렌더에서 즉시 0으로 사라져 버린다(한 프레임만 보임).
// 그래서 라운드 번호가 바뀌는 시점(= 이번 라운드의 응답이 아직 반영되기 전)에만 스냅샷을 한 번 찍고,
// 같은 라운드 안에서는 그 값을 기준으로 계속 델타를 계산해 라운드가 끝날 때까지 배지가 유지되게 한다.
let snapshotRound = -1;
let roundBaseline = {};

// 상단: 페르소나별 실시간 수용도 미터 (실제 % 에 따라 바가 채워짐 + 라운드 간 변화 뱃지)
function meterStrip(selectedIds, acceptability, lastStance, negotiating, round) {
  if (round !== snapshotRound) {
    roundBaseline = { ...acceptability };
    snapshotRound = round;
  }
  const rows = selectedIds.map((id) => {
    const p = PERSONA_BY_ID[id];
    const acc = acceptability[id];
    const has = Number.isFinite(acc);
    const pct = has ? Math.max(0, Math.min(100, acc)) : 0;
    const base = roundBaseline[id];
    const delta = has && Number.isFinite(base) ? acc - base : 0;
    const changed = delta !== 0;
    return h(
      "div",
      { class: "nego-meter" + (changed ? " nego-meter--updated" : ""), style: accentVars(p) },
      avatar(p, { sm: true }),
      h(
        "div",
        { class: "nego-meter__main" },
        h(
          "div",
          { class: "nego-meter__top" },
          h("span", { class: "nego-meter__name" }, p.name),
          lastStance[id] ? stanceBadge(lastStance[id]) : null,
          h(
            "span",
            { class: `nego-meter__pct${has ? ` is-${accLevel(pct)}` : " is-empty"}` },
            has ? `${acc}%` : "—",
            changed
              ? h(
                  "span",
                  { class: "nego-meter__delta " + (delta > 0 ? "up" : "down") },
                  `${delta > 0 ? "▲" : "▼"}${Math.abs(delta)}%p`
                )
              : null
          )
        ),
        h(
          "div",
          {
            class: "bar bar--meter",
            role: "progressbar",
            "aria-valuenow": String(pct),
            "aria-valuemin": "0",
            "aria-valuemax": "100",
            "aria-label": `${p.name} 수용도`,
          },
          h(
            "div",
            {
              class: `bar__fill${has ? ` is-${accLevel(pct)}` : ""}`,
              style: { width: `${pct}%` },
            }
          )
        )
      )
    );
  });
  return h(
    "div",
    { class: "card nego-meters" },
    h("div", { class: "block-label" }, "실시간 수용도 · Persuasion meter"),
    h("div", { class: "nego-meters__grid" }, rows),
    inviteRow(selectedIds, negotiating)
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

// prevAcc: 같은 페르소나의 직전 응답 수용도(없으면 null) → 변화 뱃지에 사용
function personaBubble(m, prevAcc) {
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
  ];

  const change = acceptabilityChange(m.acceptability, prevAcc);
  if (change) body.push(change);

  body.push(h("p", { class: "bubble__summary" }, m.text));

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

  // 새 협상(대화 없음)이면 이전 라운드 스냅샷을 초기화
  if (messages.length === 0) {
    snapshotRound = -1;
    roundBaseline = {};
  }

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

  const meters = meterStrip(selectedIds, acceptability, lastStance, negotiating, round);

  // 대화 로그 (system=중앙 안내, user=우리 측, persona=이해관계자)
  // 페르소나별 직전 응답 수용도를 추적해 각 답변에 '이전→현재' 변화 뱃지를 붙인다.
  const seenAcc = {};
  const items = messages.map((m) => {
    if (m.role === "system") return systemNote(m);
    if (m.role === "user") return userBubble(m);
    const prevAcc = Number.isFinite(seenAcc[m.personaId]) ? seenAcc[m.personaId] : null;
    const node = personaBubble(m, prevAcc);
    if (Number.isFinite(m.acceptability)) seenAcc[m.personaId] = m.acceptability;
    return node;
  });
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
