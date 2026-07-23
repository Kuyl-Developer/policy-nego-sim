// 앱 진입점 — 헤더/스텝/모드 배너 + 화면 라우팅

import { h, mount } from "./lib/dom.js";
import { getState, setState, subscribe } from "./lib/store.js";
import { getApiKey, setApiKey, isLiveMode, MODEL } from "./lib/anthropic.js";
import { renderSelectScreen } from "./screens/selectScreen.js";
import { renderChatScreen } from "./screens/chatScreen.js";
import { renderReportScreen } from "./screens/reportScreen.js";

const STEPS = [
  { id: "select", n: 1, label: "페르소나 선택" },
  { id: "chat", n: 2, label: "모의 협상" },
  { id: "report", n: 3, label: "평가·리포트" },
];

function header(screen) {
  const order = { select: 0, chat: 1, report: 2 };
  const cur = order[screen] ?? 0;

  const steps = STEPS.map((s, i) => {
    const cls =
      "step" + (i === cur ? " is-active" : "") + (i < cur ? " is-done" : "");
    return h(
      "div",
      { class: cls },
      h("span", { class: "step__num" }, i < cur ? "✓" : String(s.n)),
      h("span", {}, s.label)
    );
  });

  return h(
    "header",
    { class: "app-header" },
    h(
      "div",
      { class: "app-header__inner" },
      h(
        "div",
        { class: "brand" },
        h("div", {
          class: "brand__mark",
          html:
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1"/><circle cx="9.5" cy="7.5" r="3"/><path d="M22 20v-1a4 4 0 0 0-3-3.87"/><path d="M16 4a4 4 0 0 1 0 7.5"/></svg>',
        }),
        h(
          "div",
          {},
          h(
            "div",
            { class: "brand__titlerow" },
            h("span", { class: "brand__title" }, "치열한 논리게임"),
            h("span", { class: "brand__tagline" }, "이 제안, 거절할 수 없을걸?")
          ),
          h(
            "div",
            { class: "brand__sub" },
            "E&S 커뮤니케이션 모의 협상 · 대외 발표 전 이해관계자 반응·리스크 사전 점검"
          )
        )
      ),
      h("div", { class: "steps" }, steps)
    )
  );
}

function keyBar() {
  const live = isLiveMode();
  const input = h("input", {
    type: "password",
    placeholder: "Letsur AI Gateway 키 입력 (선택) — 비워두면 시드 모드로 동작",
    value: getApiKey(),
    autocomplete: "off",
  });

  const save = h(
    "button",
    {
      class: "btn",
      onClick: () => {
        setApiKey(input.value.trim());
        setState({ notice: "" }); // 재렌더 트리거
      },
    },
    "저장"
  );

  return h(
    "div",
    { class: "card keybar" },
    h(
      "span",
      { class: "keybar__status" },
      h("span", { class: "dot " + (live ? "dot--live" : "dot--mock") }),
      live ? `라이브 모드 · Letsur Gateway (${MODEL})` : "시드(오프라인) 모드"
    ),
    input,
    save
  );
}

function noticeBar(notice) {
  if (!notice) return null;
  return h("div", { class: "callout", style: { marginBottom: "16px" } }, notice);
}

function renderScreen(screen) {
  if (screen === "chat") return renderChatScreen();
  if (screen === "report") return renderReportScreen();
  return renderSelectScreen();
}

function render() {
  const state = getState();
  const root = document.getElementById("app");
  const main = h(
    "main",
    { class: "app-main" },
    keyBar(),
    noticeBar(state.notice),
    renderScreen(state.screen)
  );
  mount(root, h("div", {}, header(state.screen), main));
}

// 로컬 개발용 키 자동 주입(선택) — src/config.local.js 가 있으면 키를 불러와 저장.
// 파일이 없으면 조용히 무시하고 시드 모드로 시작합니다.
// (config.local.js 는 .gitignore 에 등록되어 커밋되지 않습니다.)
async function bootstrapLocalKey() {
  try {
    const mod = await import("./config.local.js");
    const key = mod?.LETSUR_API_KEY;
    // config.local.js 가 있으면 그 키를 '우선' 적용한다(로컬에 저장된 이전 키를 덮어씀).
    // 이렇게 해야 잘못 저장된 키(401) 때문에 파일의 올바른 키가 무시되는 문제가 없다.
    if (key && key !== "여기에-Letsur-Gateway-키-붙여넣기" && key !== getApiKey()) {
      setApiKey(key);
    }
  } catch {
    /* config.local.js 없음 — 무시(저장된 키 또는 시드 모드로 시작) */
  }
}

subscribe(render);
bootstrapLocalKey().finally(render);
