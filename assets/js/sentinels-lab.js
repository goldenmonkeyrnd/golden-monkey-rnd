// Functional lab activation is deliberately independent of the analytics loader.
// Article workspaces appear after activation. The direct lab already contains
// its workspace; both defer Python to the released lab's own activation button.
function sizeWorkspace(frame) {
  frame.addEventListener("load", () => {
    try {
      const document = frame.contentDocument;
      if (!document) return;
      const resize = () => { frame.style.height = `${Math.ceil(document.documentElement.scrollHeight)}px`; };
      new ResizeObserver(resize).observe(document.body);
      resize();
    } catch { /* The fixed responsive height remains usable if access is blocked. */ }
  });
}
for (const frame of document.querySelectorAll("[data-sentinels-workspace] iframe")) sizeWorkspace(frame);
for (const section of document.querySelectorAll("[data-sentinels-lab]")) {
  const button = section.querySelector("[data-sentinels-activate]");
  const container = section.querySelector("[data-sentinels-frame]");
  if (!(button instanceof HTMLButtonElement) || !(container instanceof HTMLElement)) continue;
  button.addEventListener("click", () => {
    if (container.childElementCount) return;
    const frame = document.createElement("iframe");
    frame.src = button.dataset.labUrl;
    frame.title = "Sentinels editable integration-check lab";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-downloads allow-popups allow-popups-to-escape-sandbox");
    frame.setAttribute("referrerpolicy", "same-origin");
    frame.setAttribute("aria-describedby", "sentinels-lab-scope");
    container.append(frame);
    container.setAttribute("data-sentinels-workspace", "");
    sizeWorkspace(frame);
    container.hidden = false;
    button.hidden = true;
    frame.focus();
  }, { once: true });
}
