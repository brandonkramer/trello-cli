/* global TrelloPowerUp, copyText */

var t = TrelloPowerUp.iframe();

document.querySelectorAll("button[data-copy]").forEach((button) => {
  button.addEventListener("click", () => {
    var text = document.getElementById(button.dataset.copy).textContent;
    copyText(text).then(() => {
      button.textContent = "Copied ✓";
      setTimeout(() => {
        button.textContent = "Copy";
      }, 1500);
    });
  });
});

t.render(() => {
  t.sizeTo("#content").catch(() => {});
});
