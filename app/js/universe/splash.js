// /splash.js – minimální loading bridge (bez textu, průhledné pozadí)
const splashHTML = `
<div id="app-splash" style="
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: transparent;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.5s ease-out;
">
    <img src="/app/assets/images/logo-192.png" style="width: 56px; height: auto; opacity: 0.85;">
</div>`;

document.body.insertAdjacentHTML('afterbegin', splashHTML);

window.hideSplash = () => {
  const splash = document.getElementById('app-splash');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 500);
  }
};

// Pojistka – skryje po 2.5s pokud ho nikdo neskryje dřív
setTimeout(() => {
  if (window.location.pathname.includes('/app/')) {
    window.hideSplash();
  }
}, 2500);
