/* global TrelloPowerUp */

var BASE = location.href.replace(/\/[^/]*$/, "/");
var ICON = `${BASE}icon.svg`;

/* Keep the signed-URL payload small: counts + a few attachment links. */
function slimCard(card) {
  var badges = card.badges || {};
  return {
    id: card.id,
    shortUrl: card.shortUrl,
    badges: {
      comments: badges.comments,
      attachments: badges.attachments,
      checkItems: badges.checkItems,
      checkItemsChecked: badges.checkItemsChecked,
    },
    attachments: (card.attachments || []).slice(0, 3).map((a) => ({
      name: a.name,
      url: a.url,
      date: a.date,
    })),
  };
}

TrelloPowerUp.initialize({
  "board-buttons": (_t) => [
    {
      icon: { dark: ICON, light: ICON },
      text: "trelly",
      callback: (bt) =>
        bt.modal({
          url: "./onboard.html",
          title: "Connect an AI agent with trelly",
          height: 560,
        }),
    },
  ],
  "card-buttons": (_t) => [
    {
      icon: ICON,
      text: "Copy for agent",
      callback: (bt) =>
        bt
          .card("id", "shortUrl")
          .catch(() => null)
          .then((card) =>
            bt.popup({
              title: "Copy for agent",
              url: "./copy.html",
              args: { card: card ? JSON.stringify(card) : "" },
              height: 216,
            }),
          ),
    },
  ],
  // The new Trello card back doesn't answer t.card() from inside section
  // iframes, so fetch here (connector context works) and pass via signed URL.
  "card-back-section": (t) =>
    t
      .card("id", "shortUrl", "badges", "attachments")
      .catch(() => t.card("id", "shortUrl", "attachments").catch(() => null))
      .then((card) => ({
        title: "Agent activity",
        icon: ICON,
        content: {
          type: "iframe",
          url: t.signUrl("./section.html", {
            card: card ? JSON.stringify(slimCard(card)) : "",
          }),
          height: 180,
        },
      })),
});
