/* global TrelloPowerUp, copyText, mcpSnippet, agentPrompt */

var t = TrelloPowerUp.iframe();

function bind(id, getValue) {
  document.getElementById(id).addEventListener("click", () => {
    t.card("id", "shortUrl").then((card) =>
      copyText(getValue(card)).then(() =>
        t
          .alert({ message: "Copied", duration: 2, display: "success" })
          .then(() => t.closePopup()),
      ),
    );
  });
}

bind("copy-id", (card) => card.id);
bind("copy-url", (card) => card.shortUrl);
bind("copy-mcp", () => mcpSnippet());
bind("copy-prompt", (card) => agentPrompt(card));

t.render(() => {
  t.sizeTo("#content");
});
