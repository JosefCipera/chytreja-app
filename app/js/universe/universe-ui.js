// === UNIVERSE-UI.JS ===
// UI init + helper funkce
// Panel je nyní spravován výhradně v universe-core.js

console.log("🧠 UI inicializováno");

export function setupUI(aiSpeak) {
  if (aiSpeak) {
    aiSpeak("Model vesmíru Dlouhověkost je připraven.");
  }
}
