/* global TrelloPowerUp, copyText, agentPrompt */

var t = TrelloPowerUp.iframe();

function esc(text) {
  var div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

t.render(() =>
  t.card("id", "shortUrl", "badges", "attachments").then((card) => {
    var badges = card.badges || {};
    var counts = [];
    counts.push("💬 " + (badges.comments || 0) + " comments");
    counts.push("📎 " + (card.attachments || []).length + " attachments");
    if (badges.checkItems) {
      counts.push("✓ " + (badges.checkItemsChecked || 0) + "/" + badges.checkItems);
    }
    document.getElementById("counts").innerHTML = counts
      .map((c) => "<span>" + c + "</span>")
      .join("");

    var list = (card.attachments || []).slice(0, 5);
    document.getElementById("attachments").innerHTML = list
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

    document.getElementById("copy-url").onclick = () => {
      copyText(card.shortUrl).then(() => {
        t.alert({ message: "Copied", duration: 2, display: "success" });
      });
    };
    document.getElementById("copy-prompt").onclick = () => {
      copyText(agentPrompt(card)).then(() => {
        t.alert({ message: "Copied", duration: 2, display: "success" });
      });
    };

    return t.sizeTo("#content");
  }),
);
