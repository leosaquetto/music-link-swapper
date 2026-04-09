const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();

  try {
    tg.setHeaderColor("#0f0f10");
    tg.setBackgroundColor("#0b0b0d");
  } catch (_error) {}
}
