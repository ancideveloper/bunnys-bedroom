// Minimal UI: one icon-only mute button (the page has no text, score or timer).
export function setupUI(audio) {
  const btn = document.getElementById('mute');
  const stop = (e) => e.stopPropagation();
  btn.addEventListener('pointerdown', stop);
  btn.addEventListener('keydown', stop);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.unlock();
    audio.setMuted(!audio.muted);
    btn.classList.toggle('muted', audio.muted);
    btn.blur();
  });
}
