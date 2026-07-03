/* global TrelloPowerUp, applyTheme, copyText, agentPrompt */

var t = TrelloPowerUp.iframe();
applyTheme(t);

function esc(text) {
  var div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function toast() {
  t.alert({ message: "Copied", duration: 2, display: "success" });
}

// bind immediately so the buttons work even if the data render fails
document.getElementById("copy-url").onclick = () => {
  t.card("id", "shortUrl")
    .then((card) => copyText(card.shortUrl))
    .then(toast);
};
document.getElementById("copy-prompt").onclick = () => {
  t.card("id", "shortUrl")
    .then((card) => copyText(agentPrompt(card)))
    .then(toast);
};

function renderCard(card) {
  var badges = card.badges || {};
  var attachments = card.attachments || [];
  var counts = [];
  if (badges.comments !== undefined) {
    counts.push("💬 " + badges.comments + " comments");
  }
  counts.push("📎 " + attachments.length + " attachments");
  if (badges.checkItems) {
    counts.push("✓ " + (badges.checkItemsChecked || 0) + "/" + badges.checkItems);
  }
  document.getElementById("counts").innerHTML = counts
    .map((c) => "<span>" + c + "</span>")
    .join("");

  document.getElementById("attachments").innerHTML = attachments
    .slice(0, 5)
    .map((a) => {
      var when = a.date ? " · " + a.date.slice(0, 10) : "";
      return (
        '<li><a href="' +
        esc(a.url) +
        '" target="_blank" rel="noopener">' +
        esc(a.name || a.url) +
        "</a><span class='muted'>" +
        when +
        "</span></li>"
      );
    })
    .join("");
}

t.render(() =>
  t
    .card("id", "shortUrl", "badges", "attachments")
    // some Trello contexts reject "badges" — fall back to fields that always exist
    .catch(() => t.card("id", "shortUrl", "attachments"))
    .then((card) => {
      renderCard(card);
      return t.sizeTo("#content");
    })
    .catch((err) => {
      document.getElementById("counts").textContent =
        "trelly: " + (err && err.message ? err.message : String(err));
    }),
);
