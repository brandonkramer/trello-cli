/* global TrelloPowerUp, applyTheme, copyText, mcpSnippet, agentPrompt */

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

var card = argCard();

function getCard() {
  return card ? Promise.resolve(card) : t.card("id", "shortUrl");
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
bind("copy-mcp", () => mcpSnippet());
bind("copy-prompt", (c) => agentPrompt(c));

t.render(() => t.sizeTo("#content").catch(() => {}));
