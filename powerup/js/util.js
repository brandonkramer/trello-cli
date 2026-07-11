/* Shared helpers for trelly Power-Up iframes. */

function applyTheme(t) {
  try {
    document.body.classList.toggle("dark", (t.getContext() || {}).theme === "dark");
  } catch (_err) {
    // theme is cosmetic — never let it block the page
  }
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => copyFallback(text));
  }
  return Promise.resolve(copyFallback(text));
}

function copyFallback(text) {
  var ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    ta.remove();
  }
}
