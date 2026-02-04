// /splash.js
const splashHTML = `
<div id="app-splash" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: #0f172a; z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: opacity 0.5s ease-out;">
    <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center;">
        <img src="/app/assets/images/logo-512.png" style="width: 100px; height: auto;">
    </div>
    <div style="padding-bottom: 2.5rem; text-align: center;">
        <h1 style="color: #94a3b8; font-family: sans-serif; margin: 0; font-size: 18px; font-weight: 500; letter-spacing: 0.5px;">Chytré já</h1>
        <p style="color: #475569; font-family: sans-serif; margin: 2px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px;">Medicína 3.0</p>
    </div>
</div>`;

document.body.insertAdjacentHTML('afterbegin', splashHTML);

// Funkce pro bezpečné odstranění splashe
window.hideSplash = () => {
  const splash = document.getElementById('app-splash');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 500);
  }
};

// Automatické skrytí po 2.5s (pojistka)
setTimeout(() => {
  // Pokud jsme v /app/index.html, prostě splash schováme
  if (window.location.pathname.includes('/app/')) {
    window.hideSplash();
  }
}, 2500);