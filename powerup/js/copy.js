/* global TrelloPowerUp, copyText, mcpSnippet, agentPrompt */

var t = TrelloPowerUp.iframe();

function bind(id, getValue) {
  document.getElementById(id).addEventListener("click", function () {
    t.card("id", "shortUrl").then(function (card) {
      return copyText(getValue(card)).then(function () {
        return t
          .alert({ message: "Copied", duration: 2, display: "success" })
          .then(function () {
            return t.closePopup();
          });
      });
    });
  });
}

bind("copy-id", function (card) {
  return card.id;
});
bind("copy-url", function (card) {
  return card.shortUrl;
});
bind("copy-mcp", function () {
  return mcpSnippet();
});
bind("copy-prompt", function (card) {
  return agentPrompt(card);
});

t.render(function () {
  t.sizeTo("#content");
});
