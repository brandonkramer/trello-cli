/* global TrelloPowerUp, applyTheme, copyText */

var t = TrelloPowerUp.iframe();
applyTheme(t);

/* Card data arrives via popup args (see connector.js); t.card() is a
   fallback since the new card back may not answer it. */
function argCard() {
  var raw;
  try {
    raw = t.arg("card");
    return raw ? JSON.parse(raw) : null;
  } catch (_err) {
    return null;
  }
}

function contextCard() {
  var ctx;
  try {
    ctx = t.getContext();
  } catch (_err) {
    ctx = null;
  }
  return ctx && ctx.card
    ? { id: ctx.card, shortUrl: `https://trello.com/c/${ctx.card}` }
    : null;
}

var card = argCard();

function getCard() {
  if (card) {
    return Promise.resolve(card);
  }
  return t.card("id", "shortUrl").catch(() => contextCard());
}

function flash(button) {
  var label = button.textContent;
  button.textContent = "Copied ✓";
  setTimeout(() => {
    button.textContent = label;
  }, 1200);
}

function bind(id, getValue) {
  var button = document.getElementById(id);
  button.addEventListener("click", () => {
    getCard()
      .then((c) => copyText(getValue(c)))
      .then(() => {
        flash(button);
        return t
          .alert({ message: "Copied", duration: 2, display: "success" })
          .then(() => t.closePopup())
          .catch(() => {});
      })
      .catch(() => {});
  });
}

bind("copy-id", (c) => c.id);
bind("copy-url", (c) => c.shortUrl);

t.render(() => t.sizeTo("#content").catch(() => {}));
