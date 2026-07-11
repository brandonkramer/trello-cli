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
  "card-buttons": (_t) => [
    {
      icon: ICON,
      text: "Copy card link",
      callback: (bt) =>
        bt
          .card("id", "shortUrl")
          .catch(() => null)
          .then((card) =>
            bt.popup({
              title: "Copy card link",
              url: "./copy.html",
              args: { card: card ? JSON.stringify(card) : "" },
              height: 140,
            }),
          ),
    },
  ],
  // The new Trello card back doesn't answer t.card() (the data command) even
  // from the connector, while UI commands still work. Fall back to the
  // board-scoped t.cards(), which the main board frame does answer, and pass
  // the result to the section via signed URL.
  "card-back-section": (t) =>
    t
      .card("id", "shortUrl", "badges", "attachments")
      .catch(() =>
        t.cards("id", "shortUrl", "badges").then((cards) => {
          var hit = cards.find((c) => c.id === t.getContext()?.card);
          if (!hit) {
            throw new Error("card not in board cache");
          }
          return hit;
        }),
      )
      .catch(() => null)
      .then((card) => ({
        title: "Card snapshot",
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
