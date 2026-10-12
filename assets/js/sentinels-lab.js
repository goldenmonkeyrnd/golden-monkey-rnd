// Functional lab activation is deliberately independent of the analytics loader.
// No iframe or Python runtime is requested before the visitor activates it.
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
    container.hidden = false;
    button.hidden = true;
    frame.focus();
  }, { once: true });
}
