/* global TrelloPowerUp, copyText */

var t = TrelloPowerUp.iframe();

document.querySelectorAll("button[data-copy]").forEach(function (button) {
  button.addEventListener("click", function () {
    var text = document.getElementById(button.dataset.copy).textContent;
    copyText(text).then(function () {
      button.textContent = "Copied ✓";
      setTimeout(function () {
        button.textContent = "Copy";
      }, 1500);
    });
  });
});

t.render(function () {
  t.sizeTo("#content").catch(function () {});
});
