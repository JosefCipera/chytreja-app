// === UNIVERSE-VOICE.JS ===
// Hlasový výstup a zvukové efekty

export function aiSpeak(text) {
  if (!window.speechSynthesis) return;
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "cs-CZ";
  msg.rate = 1.0;
  msg.pitch = 1.1;

  const voices = speechSynthesis.getVoices();
  const czFemale = voices.find(v => /czech/i.test(v.lang) && /female/i.test(v.name));
  if (czFemale) msg.voice = czFemale;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(msg);
}

export function playWhoosh() {
  const audio = new Audio("https://files.catbox.moe/2t6h4j.mp3");
  audio.volume = 0.25;
  audio.play().catch(() => { });
}
