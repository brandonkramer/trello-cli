/* global TrelloPowerUp */

var BASE = location.href.replace(/\/[^/]*$/, "/");
var ICON = `${BASE}icon.svg`;

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
});
