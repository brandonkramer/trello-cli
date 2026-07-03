/* global TrelloPowerUp */

var BASE = location.href.replace(/\/[^/]*$/, "/");
var ICON = BASE + "icon.svg";

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
        bt.popup({
          title: "Copy for agent",
          url: "./copy.html",
          height: 216,
        }),
    },
  ],
  "card-back-section": (t) => ({
    title: "Agent activity",
    icon: ICON,
    content: {
      type: "iframe",
      url: t.signUrl("./section.html"),
      height: 180,
    },
  }),
});
