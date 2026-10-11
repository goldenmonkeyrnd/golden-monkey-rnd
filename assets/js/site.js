(() => {
  const script = document.currentScript;
  const privateBrowser = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" || window.doNotTrack === "1";
  if (privateBrowser) return;
  const token = script?.dataset.analyticsToken;
  if (token) { const beacon = document.createElement("script"); beacon.defer = true; beacon.src = "https://static.cloudflareinsights.com/beacon.min.js"; beacon.setAttribute("data-cf-beacon", JSON.stringify({token})); document.head.append(beacon); }
  const allowed = new Set(["conference_viewed", "github_clicked", "resume_downloaded", "walkthrough_started", "email_clicked"]);
  const sent = new Set();
  let count = 0;
  const send = (event) => {
    if (!allowed.has(event) || count >= 20 || (event === "conference_viewed" && sent.has(event))) return;
    sent.add(event); count += 1;
    fetch("https://atlas.goldenmonkey.dev/api/events", {method:"POST", mode:"cors", credentials:"omit", keepalive:true, headers:{"Content-Type":"application/json"}, body:JSON.stringify({event,surface:"portfolio",campaign:"nava-2026"})}).catch(() => {});
  };
  if (document.querySelector("[data-conference-page]")) send("conference_viewed");
  document.addEventListener("click", (e) => { const element = e.target instanceof Element ? e.target.closest("a") : null; if (!element) return; const href = element.getAttribute("href") || ""; const event = element.dataset.event || (href.startsWith("mailto:") ? "email_clicked" : href.startsWith("https://github.com/goldenmonkeyrnd") ? "github_clicked" : href.endsWith("Pauline_Yeary_Resume.pdf") ? "resume_downloaded" : null); if (event) send(event); });
  document.querySelectorAll("video[data-event]").forEach(video => video.addEventListener("play", () => send(video.dataset.event), {once:true}));
})();
