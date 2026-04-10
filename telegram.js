const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();

  try {
    tg.expand();
  } catch (_error) {}

  applyTelegramTheme();

  try {
    if (typeof tg.isVerticalSwipesEnabled !== "undefined" && tg.disableVerticalSwipes) {
      tg.disableVerticalSwipes();
    }
  } catch (_error) {}

  try {
    if (tg.requestFullscreen) {
      tg.requestFullscreen();
    }
  } catch (_error) {}

  syncTelegramViewportVars();

  tg.onEvent?.("viewportChanged", () => {
    syncTelegramViewportVars();
  });
} else {
  syncTelegramViewportVars();
}

window.addEventListener("mls-theme-change", applyTelegramTheme);
window.addEventListener("resize", syncTelegramViewportVars);
window.addEventListener("orientationchange", syncTelegramViewportVars);

function applyTelegramTheme() {
  if (!tg) return;

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const headerColor = isDark ? "#0f0f10" : "#f7f8fb";
  const backgroundColor = isDark ? "#0b0b0d" : "#f7f8fb";

  try {
    tg.setHeaderColor(headerColor);
    tg.setBackgroundColor(backgroundColor);
  } catch (_error) {}

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", backgroundColor);
  }
}

function syncTelegramViewportVars() {
  const viewportHeight = tg?.viewportHeight || window.innerHeight;
  const stableHeight = tg?.viewportStableHeight || window.innerHeight;

  document.documentElement.style.setProperty("--tg-viewport-height", `${viewportHeight}px`);
  document.documentElement.style.setProperty("--tg-viewport-stable-height", `${stableHeight}px`);
}
