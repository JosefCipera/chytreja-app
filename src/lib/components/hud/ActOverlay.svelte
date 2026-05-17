<script>
  let { onClose = null, onComplete = null } = $props();

  let current = $state(0);
  let startX = 0, startY = 0, dragging = false, locked = false;

  function goTo(n) {
    current = Math.max(0, Math.min(2, n));
  }

  function onTouchStart(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = true; locked = false;
  }

  function onTouchMove(e) {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!locked) {
      locked = true;
      if (Math.abs(dy) > Math.abs(dx)) { dragging = false; return; }
    }
    e.preventDefault();
  }

  function onTouchEnd(e) {
    if (!dragging) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > window.innerWidth * 0.2) goTo(current + (dx < 0 ? 1 : -1));
    dragging = false;
  }

  function handleDone() {
    onComplete?.();
    onClose?.();
  }
</script>

<div
  style="
    position: fixed; inset: 0; z-index: 9999;
    background: #000; overflow: hidden;
  "
  ontouchstart={onTouchStart}
  ontouchmove={onTouchMove}
  ontouchend={onTouchEnd}
>
  <!-- X button -->
  <button
    onclick={onClose}
    style="
      position: absolute; top: 16px; right: 16px; z-index: 10;
      background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2);
      color: #94a3b8; font-size: 18px; width: 36px; height: 36px;
      border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
    "
  >✕</button>

  <!-- Sliding track -->
  <div style="
    display: flex;
    width: 300%;
    height: 100%;
    transform: translateX(-{current * 33.333}%);
    transition: transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  ">
    <!-- Slide 1: PRE -->
    <div style="width: 33.333%; height: 100%; overflow: hidden; position: relative; flex-shrink: 0;">
      <img src="/mockups/act-screens.jpg" alt=""
        style="width: 300%; height: 100%; object-fit: cover; object-position: 0% center; display: block;">
    </div>

    <!-- Slide 2: ACTIVE -->
    <div style="width: 33.333%; height: 100%; overflow: hidden; position: relative; flex-shrink: 0;">
      <img src="/mockups/act-screens.jpg" alt=""
        style="width: 300%; height: 100%; object-fit: cover; object-position: 50% center; display: block; margin-left: -100%;">
    </div>

    <!-- Slide 3: POST -->
    <div style="width: 33.333%; height: 100%; overflow: hidden; position: relative; flex-shrink: 0;">
      <img src="/mockups/act-screens.jpg" alt=""
        style="width: 300%; height: 100%; object-fit: cover; object-position: 100% center; display: block; margin-left: -200%;">
      <!-- HOTOVO overlay button -->
      {#if current === 2}
        <button
          onclick={handleDone}
          style="
            position: absolute; bottom: 60px; left: 50%; transform: translateX(-50%);
            background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.4);
            color: #4ade80; font-family: 'JetBrains Mono', monospace;
            font-size: 16px; letter-spacing: 0.1em; padding: 14px 40px;
            border-radius: 10px; cursor: pointer; white-space: nowrap;
          "
        >✓ HOTOVO</button>
      {/if}
    </div>
  </div>

  <!-- Dot indicators -->
  <div style="
    position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 8px;
  ">
    {#each [0,1,2] as i}
      <button
        onclick={() => goTo(i)}
        style="
          width: 8px; height: 8px; border-radius: 50%; border: none; cursor: pointer;
          background: {current === i ? '#fff' : 'rgba(255,255,255,0.35)'};
          transform: {current === i ? 'scale(1.3)' : 'scale(1)'};
          transition: background 0.2s, transform 0.2s;
          padding: 0;
        "
      ></button>
    {/each}
  </div>
</div>
