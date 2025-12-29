const app = document.getElementById("app");

async function loadPage(page) {
  const res = await fetch(`/public/pages/${page}.html`);
  const html = await res.text();
  app.innerHTML = html;
  if (page === "model") {
    await import("src/js/universe-init.js");
  }
}

function handleHashChange() {
  const page = location.hash.replace("#", "") || "model";
  loadPage(page);
}

window.addEventListener("hashchange", handleHashChange);
window.addEventListener("DOMContentLoaded", handleHashChange);
