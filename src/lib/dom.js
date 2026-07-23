// 아주 작은 DOM 헬퍼 (프레임워크 없이 사용) — 빌드 스텝 불필요

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") {
        // CSS 커스텀 프로퍼티(--accent 등)는 el.style["--x"] = v 로는 반영되지 않으므로 setProperty 사용
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith("--")) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      }
      else if (k === "html") el.innerHTML = v;
      else if (k === "dataset" && typeof v === "object") Object.assign(el.dataset, v);
      else if (k.startsWith("on") && typeof v === "function")
        el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && k !== "list") {
        try { el[k] = v; } catch { el.setAttribute(k, v); }
      } else el.setAttribute(k, v);
    }
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(root, node) {
  clear(root);
  root.append(node);
  return root;
}
