/* global TrelloPowerUp */

var BASE = location.href.replace(/\/[^/]*$/, "/");
var ICON = BASE + "icon.svg";

TrelloPowerUp.initialize({
  "board-buttons": function (t) {
    return [
      {
        icon: { dark: ICON, light: ICON },
        text: "trelly",
        callback: function (bt) {
          return bt.modal({
            url: "./onboard.html",
            title: "Connect an AI agent with trelly",
            height: 560,
          });
        },
      },
    ];
  },
  "card-buttons": function (t) {
    return [
      {
        icon: ICON,
        text: "Copy for agent",
        callback: function (bt) {
          return bt.popup({
            title: "Copy for agent",
            url: "./copy.html",
            height: 216,
          });
        },
      },
    ];
  },
  "card-back-section": function (t) {
    return {
      title: "Agent activity",
      icon: ICON,
      content: {
        type: "iframe",
        url: t.signUrl("./section.html"),
        height: 180,
      },
    };
  },
});
