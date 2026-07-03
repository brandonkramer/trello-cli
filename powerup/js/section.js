/* global TrelloPowerUp, applyTheme, copyText, agentPrompt */

var t = TrelloPowerUp.iframe();
applyTheme(t);

function esc(text) {
  var div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/* Card data arrives via the signed URL (see connector.js) because the new
   Trello card back doesn't answer t.card() from section iframes. */
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

var card = argCard() || contextCard();

function flash(button) {
  var label = button.textContent;
  button.textContent = "Copied ✓";
  setTimeout(() => {
    button.textContent = label;
  }, 1500);
}

function bind(id, getValue) {
  var button = document.getElementById(id);
  button.addEventListener("click", () => {
    if (!card) {
      return;
    }
    copyText(getValue(card)).then(() => flash(button));
  });
}

bind("copy-url", (c) => c.shortUrl);
bind("copy-prompt", (c) => agentPrompt(c));

function renderCard() {
  var badges = card.badges || {};
  var attachments = card.attachments || [];
  var counts = [];
  if (badges.comments !== undefined) {
    counts.push(`💬 ${badges.comments} comments`);
  }
  var attachmentCount =
    badges.attachments !== undefined ? badges.attachments : attachments.length;
  counts.push(`📎 ${attachmentCount} attachments`);
  if (badges.checkItems) {
    counts.push(`✓ ${badges.checkItemsChecked || 0}/${badges.checkItems}`);
  }
  document.getElementById("counts").innerHTML = counts
    .map((c) => `<span>${c}</span>`)
    .join("");

  document.getElementById("attachments").innerHTML = attachments
    .map((a) => {
      var when = a.date ? ` · ${a.date.slice(0, 10)}` : "";
      return `<li><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(
        a.name || a.url,
      )}</a><span class='muted'>${when}</span></li>`;
    })
    .join("");
}

if (card && (card.badges || card.attachments)) {
  renderCard();
}

t.render(() => t.sizeTo("#content").catch(() => {}));
