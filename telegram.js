const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();

  try {
    tg.expand();
  } catch (_error) {}

  try {
    tg.setHeaderColor("#0f0f10");
    tg.setBackgroundColor("#0b0b0d");
  } catch (_error) {}

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

function syncTelegramViewportVars() {
  const viewportHeight = tg?.viewportHeight || window.innerHeight;
  const stableHeight = tg?.viewportStableHeight || window.innerHeight;

  document.documentElement.style.setProperty("--tg-viewport-height", `${viewportHeight}px`);
  document.documentElement.style.setProperty("--tg-viewport-stable-height", `${stableHeight}px`);
}

window.addEventListener("resize", syncTelegramViewportVars);
window.addEventListener("orientationchange", syncTelegramViewportVars);