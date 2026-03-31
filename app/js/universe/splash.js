// /splash.js – loading bridge: logo + text, skryje se až je vesmír připraven
const splashHTML = `
<div id="app-splash" style="
    position: fixed; top: 0; left: 0;
    width: 100%; height: 100%;
    background-color: #0f172a;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition: opacity 0.5s ease-out;
">
    <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="80" height="80">
            <circle cx="24" cy="24" r="18" fill="none" stroke="#2563eb" stroke-width="4.5" stroke-dasharray="105 13" stroke-dashoffset="97" transform="rotate(-90 24 24)" />
        </svg>
    </div>
    <div style="padding-bottom: 2.5rem; text-align: center;">
        <h1 style="color: #e2e8f0; font-family: sans-serif; margin: 0; font-size: 28px; font-weight: 500; letter-spacing: 0.5px;">Chytré já</h1>
        <p style="color: #94a3b8; font-family: sans-serif; margin: 8px 0 0 0; font-size: 15px; text-transform: uppercase; letter-spacing: 2px;">Medicína 3.0</p>
        <p style="color: #64748b; font-family: sans-serif; margin: 14px 0 0 0; font-size: 12px; letter-spacing: 0.5px;">v0.2.0</p>
    </div>
</div>`;

document.body.insertAdjacentHTML('afterbegin', splashHTML);

window.hideSplash = () => {
  const splash = document.getElementById('app-splash');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 500);
  }
};

// Pojistka – skryje po 4s pokud ho vesmír neskryje dřív
setTimeout(() => {
  if (window.hideSplash) window.hideSplash();
}, 4000);
