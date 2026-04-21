<script>
  // ──────────────────────────────────────────────────
  // HealthUpload.svelte — Health Document Parser UI
  //
  // Props:
  //   userId      string  — user ID
  //   onComplete  fn(result) — called after successful parse
  //   onClose     fn()       — called when user closes
  // ──────────────────────────────────────────────────

  let { userId, onComplete, onClose } = $props();

  let file        = $state(null);
  let previewUrl  = $state(null);
  let uploading   = $state(false);
  let result      = $state(null);   // parsed result from API
  let error       = $state(null);
  let dragOver    = $state(false);

  const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const MAX_SIZE_MB = 3.5;

  function handleFile(f) {
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) {
      error = 'Nepodporovaný formát. Nahraj JPG, PNG nebo PDF.';
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      error = `Soubor je příliš velký (${(f.size / 1024 / 1024).toFixed(1)} MB). Maximum je ${MAX_SIZE_MB} MB.`;
      return;
    }
    error = null;
    file = f;

    // Preview for images
    if (f.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(f);
    } else {
      previewUrl = null;
    }
  }

  function onInputChange(e) {
    handleFile(e.target.files?.[0]);
  }

  function onDrop(e) {
    e.preventDefault();
    dragOver = false;
    handleFile(e.dataTransfer.files?.[0]);
  }

  async function upload() {
    if (!file || uploading) return;
    uploading = true;
    error = null;

    try {
      // Convert file to base64
      const base64 = await fileToBase64(file);

      const res = await fetch('/api/tools/health-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          fileBase64: base64,
          mediaType: file.type,
          fileName: file.name,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        error = data.error || 'Analýza selhala. Zkus znovu.';
        return;
      }

      result = data;
      if (onComplete) onComplete(data);

    } catch (e) {
      error = 'Chyba připojení. Zkontroluj internet a zkus znovu.';
      console.error('[CHJ] health-parse upload failed:', e);
    } finally {
      uploading = false;
    }
  }

  function fileToBase64(f) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result = "data:image/jpeg;base64,/9j/..."
        // We only want the base64 part after the comma
        const b64 = reader.result.split(',')[1];
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  function reset() {
    file = null;
    previewUrl = null;
    result = null;
    error = null;
  }

  // State badge color
  function stateColor(state) {
    return state === 'RED' ? 'text-red-400' : state === 'YELLOW' ? 'text-yellow-400' : 'text-green-400';
  }

  function deltaLabel(delta) {
    if (delta > 0) return `+${delta}`;
    return String(delta);
  }
</script>

<!-- Modal overlay -->
<div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm">
  <div class="w-full max-w-md mx-4 mb-4 sm:mb-0 rounded-2xl border border-cyan-500/20 bg-slate-900/95 backdrop-blur-md shadow-2xl overflow-hidden">

    <!-- Header -->
    <div class="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-800">
      <div>
        <div class="hud-mono text-[10px] text-cyan-400/60 tracking-widest uppercase">Health Document Parser</div>
        <div class="text-sm text-slate-200 mt-0.5">Nahraj zdravotní dokument</div>
      </div>
      <button
        onclick={onClose}
        class="text-slate-500 hover:text-slate-300 transition-colors p-1"
        aria-label="Zavřít"
      >✕</button>
    </div>

    <!-- Body -->
    <div class="px-4 py-4">

      {#if result}
        <!-- ── RESULT VIEW ── -->
        <div class="space-y-3">

          <!-- Summary -->
          <div class="rounded-lg bg-slate-800/60 border border-slate-700/50 p-3">
            <div class="hud-mono text-[9px] text-cyan-400/60 tracking-widest mb-1">
              {result.doc_type?.toUpperCase() ?? 'DOKUMENT'} · {result.doc_date ?? ''}
            </div>
            <div class="text-sm text-slate-200">{result.summary}</div>
          </div>

          <!-- Flags -->
          {#if result.flags?.includes('CONSULT_DOCTOR')}
            <div class="rounded-lg bg-red-950/40 border border-red-500/30 p-3 flex items-start gap-2">
              <span class="text-red-400 mt-0.5">⚠</span>
              <div>
                <div class="text-sm text-red-300 font-medium">Konzultuj s lékařem</div>
                <div class="text-xs text-red-400/70 mt-0.5">Dokument obsahuje hodnoty mimo referenční rozsah. Výsledky jsou uloženy, konzultuj s lékařem.</div>
              </div>
            </div>
          {/if}

          <!-- Node updates -->
          {#if result.node_updates?.length}
            <div>
              <div class="hud-mono text-[9px] text-slate-500 tracking-widest mb-2">AKTUALIZOVANÉ UZLY</div>
              <div class="space-y-1.5">
                {#each result.node_updates as n}
                  <div class="flex items-center justify-between rounded-lg bg-slate-800/40 border border-slate-700/30 px-3 py-2">
                    <div class="flex items-center gap-2">
                      <span class="hud-mono text-[10px] text-slate-400 uppercase">{n.node_id}</span>
                    </div>
                    <div class="flex items-center gap-3">
                      <span class="text-xs text-slate-500">{n.previous_index}</span>
                      <span class="text-xs text-slate-600">→</span>
                      <span class="text-sm font-medium {stateColor(n.state)}">{n.new_index}</span>
                      <span class="hud-mono text-[9px] {n.delta < 0 ? 'text-red-400' : 'text-green-400'}">
                        {deltaLabel(n.delta)}
                      </span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Markers count -->
          <div class="text-xs text-slate-500">
            Extrahováno {result.markers_found} markerů
            {#if result.constraints_saved?.length}
              · {result.constraints_saved.length} omezení uloženo
            {/if}
          </div>

          <!-- Actions -->
          <div class="flex gap-2 pt-1">
            <button
              onclick={reset}
              class="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm hover:border-cyan-500/30 hover:text-slate-200 transition-all"
            >
              Nahrát další
            </button>
            <button
              onclick={onClose}
              class="flex-1 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm hover:bg-cyan-500/20 transition-all"
            >
              Hotovo
            </button>
          </div>
        </div>

      {:else}
        <!-- ── UPLOAD VIEW ── -->

        <!-- Drop zone -->
        <div
          role="button"
          tabindex="0"
          class="relative rounded-xl border-2 border-dashed transition-all cursor-pointer
            {dragOver ? 'border-cyan-400/60 bg-cyan-500/5' : 'border-slate-700/60 hover:border-slate-600/80'}
            {file ? 'border-cyan-500/30 bg-cyan-500/5' : ''}"
          ondragover={(e) => { e.preventDefault(); dragOver = true; }}
          ondragleave={() => { dragOver = false; }}
          ondrop={onDrop}
          onclick={() => document.getElementById('health-file-input').click()}
          onkeydown={(e) => e.key === 'Enter' && document.getElementById('health-file-input').click()}
        >
          <input
            id="health-file-input"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            class="sr-only"
            onchange={onInputChange}
          />

          {#if previewUrl}
            <!-- Image preview -->
            <img src={previewUrl} alt="Náhled dokumentu" class="w-full h-40 object-contain rounded-xl p-2" />
          {:else if file}
            <!-- PDF selected -->
            <div class="flex flex-col items-center justify-center h-32 gap-2">
              <div class="text-3xl">📄</div>
              <div class="text-sm text-slate-300">{file.name}</div>
              <div class="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</div>
            </div>
          {:else}
            <!-- Empty state -->
            <div class="flex flex-col items-center justify-center h-36 gap-3 px-4">
              <div class="text-3xl opacity-60">🔬</div>
              <div class="text-center">
                <div class="text-sm text-slate-300">Přetáhni nebo klikni pro výběr</div>
                <div class="text-xs text-slate-500 mt-1">Krevní výsledky · Holter · EKG · Zpráva lékaře</div>
                <div class="text-xs text-slate-600 mt-0.5">JPG, PNG, PDF · max 3,5 MB</div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Error -->
        {#if error}
          <div class="mt-3 rounded-lg bg-red-950/40 border border-red-500/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        {/if}

        <!-- Info -->
        {#if !file && !error}
          <div class="mt-3 text-xs text-slate-600 leading-relaxed">
            Dokument se zpracuje automaticky. Hodnoty se promítnou do tvých uzlů.
            Formát se rozpozná — příštím nahráním ze stejné laboratoře stačí jen přiložit soubor.
          </div>
        {/if}

        <!-- Submit -->
        <button
          onclick={upload}
          disabled={!file || uploading}
          class="mt-4 w-full py-3 rounded-xl font-medium text-sm transition-all
            {file && !uploading
              ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-400/60'
              : 'bg-slate-800/40 border border-slate-700/40 text-slate-600 cursor-not-allowed'}"
        >
          {#if uploading}
            <span class="animate-pulse">Analyzuji dokument…</span>
          {:else if file}
            Analyzovat dokument
          {:else}
            Vyber soubor
          {/if}
        </button>
      {/if}

    </div>
  </div>
</div>
