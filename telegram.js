const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();

  try {
    tg.setHeaderColor("#0b0b0d");
    tg.setBackgroundColor("#0b0b0d");
  } catch (e) {}
}
