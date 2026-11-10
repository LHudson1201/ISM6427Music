// SongForge front-end. Talks only to our own Netlify Functions under /api/*;
// the sunoapi.org key never reaches the browser.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const STORE_KEY = "songforge.jobs.v1";
const POLL_MS = 5000;
const MAX_POLL_MS = 15 * 60 * 1000;

const IDEAS = [
  "A dreamy lo-fi track about late-night studying in the rain",
  "An anthemic rock song about never giving up",
  "A soulful R&B love song set in a jazz club",
  "An upbeat K-pop dance track about summer",
  "A country ballad about a small hometown",
  "Epic orchestral music for a fantasy battle",
];
const STYLES = ["pop", "lo-fi hip hop", "synthwave", "acoustic folk", "EDM", "jazz", "R&B", "rock", "cinematic", "reggaeton", "country", "trap"];
const VARIETY = ["Off", "Normal", "High", "Extra", "Max"];
const STATUS_LABEL = {
  PENDING: "Queued",
  TEXT_SUCCESS: "Writing",
  FIRST_SUCCESS: "Rendering",
  SUCCESS: "Ready",
  CREATE_TASK_FAILED: "Failed",
  GENERATE_AUDIO_FAILED: "Failed",
  CALLBACK_EXCEPTION: "Failed",
  SENSITIVE_WORD_ERROR: "Blocked",
};
const FAILED = new Set(["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION", "SENSITIVE_WORD_ERROR"]);

let mode = "simple";
let jobs = loadJobs();

// ---------- storage ----------
function loadJobs() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}
function saveJobs() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(jobs.slice(0, 50))); } catch {}
}

// ---------- api ----------
async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- credits ----------
async function refreshCredits() {
  const el = $("#credits");
  try {
    const { credits } = await api("/api/credits");
    $("#creditsValue").textContent = `${Number(credits).toLocaleString()} credits`;
    el.classList.add("ok"); el.classList.remove("bad");
  } catch (e) {
    $("#creditsValue").textContent = "Offline";
    el.title = e.message;
    el.classList.add("bad"); el.classList.remove("ok");
  }
}

// ---------- form UI ----------
function setMode(m) {
  mode = m;
  $$(".tab").forEach((t) => {
    const on = t.dataset.mode === m;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", on);
  });
  $(".mode-simple").hidden = m !== "simple";
  $(".mode-custom").hidden = m !== "custom";
  syncInstrumental();
}

function syncInstrumental() {
  const inst = $("#instrumental").checked;
  $(".lyrics-field").hidden = inst;
  $("#vocalGender").disabled = inst;
}

function chip(text, onClick) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "chip"; b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

function initChips() {
  IDEAS.forEach((i) => $("#ideaChips").append(chip(i.length > 34 ? i.slice(0, 32) + "…" : i, () => setVal("#prompt", i))));
  STYLES.forEach((s) =>
    $("#styleChips").append(chip(s, () => {
      const el = $("#style");
      const cur = el.value.split(",").map((x) => x.trim()).filter(Boolean);
      if (!cur.includes(s)) cur.push(s);
      setVal("#style", cur.join(", "));
    }))
  );
}

function setVal(sel, v) {
  const el = $(sel);
  el.value = v;
  el.dispatchEvent(new Event("input"));
  el.focus();
}

function initCounters() {
  $$(".count").forEach((c) => {
    const el = document.getElementById(c.dataset.for);
    const max = el.maxLength;
    const upd = () => (c.textContent = `${el.value.length}/${max}`);
    el.addEventListener("input", upd); upd();
  });
}

function initSliders() {
  const bind = (id, out, fmt) => {
    const el = $(id), o = $(out);
    const upd = () => (o.textContent = fmt(el.value));
    el.addEventListener("input", upd); upd();
  };
  bind("#duration", "#durationOut", (v) => (+v === 0 ? "Auto" : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`));
  bind("#styleWeight", "#styleWeightOut", (v) => (+v).toFixed(2));
  bind("#weirdnessConstraint", "#weirdOut", (v) => (+v).toFixed(2));
  bind("#variety", "#varietyOut", (v) => VARIETY[v]);
}

function showError(msg) {
  const e = $("#formError");
  e.textContent = msg || "";
  e.hidden = !msg;
}

function setBusy(btn, busy, label) {
  btn.disabled = busy;
  btn.innerHTML = busy ? `<span class="spinner"></span>${label}` : label;
}

function collect() {
  const instrumental = $("#instrumental").checked;
  const base = {
    customMode: mode === "custom",
    instrumental,
    model: $("#model").value,
    style: $("#style").value.trim(),
  };
  if (mode === "simple") {
    return { ...base, prompt: $("#prompt").value.trim() };
  }
  const duration = +$("#duration").value;
  return {
    ...base,
    title: $("#title").value.trim(),
    lyrics: instrumental ? "" : $("#lyrics").value.trim(),
    negativeTags: $("#negativeTags").value.trim(),
    vocalGender: instrumental ? "" : $("#vocalGender").value,
    duration: duration || undefined,
    styleWeight: +$("#styleWeight").value,
    weirdnessConstraint: +$("#weirdnessConstraint").value,
    variety: +$("#variety").value,
  };
}

function validate(p) {
  if (!p.customMode && !p.prompt && !p.style) return "Describe the song you want, or add a style.";
  if (p.customMode && !p.style && !p.lyrics && !p.negativeTags) return "Add a style or lyrics to get started.";
  return null;
}

async function onGenerate(e) {
  e.preventDefault();
  showError(null);
  const payload = collect();
  const err = validate(payload);
  if (err) return showError(err);

  const btn = $("#genBtn");
  setBusy(btn, true, "Starting…");
  try {
    const { taskId } = await api("/api/generate", { method: "POST", body: JSON.stringify(payload) });
    const job = {
      taskId,
      label: payload.title || payload.prompt || payload.style || "Untitled",
      meta: [payload.model.replace("_", " "), payload.instrumental ? "Instrumental" : null, payload.style || null].filter(Boolean).join(" · "),
      createdAt: Date.now(),
      status: "PENDING",
      tracks: [],
    };
    jobs.unshift(job);
    saveJobs();
    render();
    poll(job);
  } catch (ex) {
    showError(ex.message);
  } finally {
    setBusy(btn, false, "Generate song");
  }
}

// ---------- lyrics helper ----------
async function onWriteLyrics() {
  const idea = $("#lyricIdea").value.trim() || $("#title").value.trim() || $("#style").value.trim();
  if (!idea) { showError("Describe a theme for the lyrics first."); $("#lyricIdea").focus(); return; }
  showError(null);
  const btn = $("#lyricBtn");
  setBusy(btn, true, "Writing…");
  const box = $("#lyricOptions");
  box.hidden = true; box.innerHTML = "";
  try {
    const { taskId } = await api("/api/lyrics", { method: "POST", body: JSON.stringify({ prompt: idea }) });
    const started = Date.now();
    while (Date.now() - started < 3 * 60 * 1000) {
      await sleep(3000);
      const r = await api(`/api/lyrics?taskId=${encodeURIComponent(taskId)}`);
      if (FAILED.has(r.status) || r.status === "GENERATE_LYRICS_FAILED") throw new Error(r.errorMessage || "Lyrics generation failed.");
      if (r.status === "SUCCESS" && r.lyrics.length) {
        r.lyrics.forEach((l) => {
          const b = document.createElement("button");
          b.type = "button"; b.className = "lyric-opt";
          b.innerHTML = `<strong></strong><span></span>`;
          b.querySelector("strong").textContent = l.title ? `Use “${l.title}”` : "Use these lyrics";
          b.querySelector("span").textContent = l.text;
          b.addEventListener("click", () => {
            setVal("#lyrics", l.text);
            if (l.title && !$("#title").value) setVal("#title", l.title.slice(0, 80));
            box.hidden = true;
          });
          box.append(b);
        });
        box.hidden = false;
        return;
      }
    }
    throw new Error("Lyrics are taking too long. Try again.");
  } catch (ex) {
    showError(ex.message);
  } finally {
    setBusy(btn, false, "✨ Write lyrics");
  }
}

// ---------- polling ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const polling = new Set();
const openLyrics = new Set();

async function poll(job) {
  if (polling.has(job.taskId)) return;
  polling.add(job.taskId);
  try {
    while (Date.now() - job.createdAt < MAX_POLL_MS) {
      try {
        const r = await api(`/api/status?taskId=${encodeURIComponent(job.taskId)}`);
        job.status = r.status;
        job.error = r.errorMessage;
        if (r.tracks?.length) job.tracks = r.tracks;
        saveJobs();
        render();
        if (r.status === "SUCCESS") { refreshCredits(); return; }
        if (FAILED.has(r.status)) return;
      } catch (ex) {
        job.lastError = ex.message;
      }
      await sleep(POLL_MS);
    }
    if (job.status !== "SUCCESS" && !FAILED.has(job.status)) {
      job.status = "CREATE_TASK_FAILED";
      job.error = "Timed out waiting for the song.";
      saveJobs(); render();
    }
  } finally {
    polling.delete(job.taskId);
  }
}

// ---------- rendering ----------
function fmtTime(s) {
  s = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function timeAgo(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString();
}

function render() {
  const wrap = $("#jobs");
  wrap.innerHTML = "";
  $("#empty").hidden = jobs.length > 0;
  $("#clearBtn").hidden = jobs.length === 0;

  for (const job of jobs) {
    const node = $("#jobTpl").content.firstElementChild.cloneNode(true);
    $(".job-title", node).textContent = job.label;
    $(".job-sub", node).textContent = `${job.meta} · ${timeAgo(job.createdAt)}`;
    const badge = $(".badge", node);
    const failed = FAILED.has(job.status);
    badge.textContent = STATUS_LABEL[job.status] || job.status;
    badge.classList.add(failed ? "failed" : job.status === "SUCCESS" ? "done" : "pending");

    const tracksEl = $(".job-tracks", node);
    if (failed) {
      const p = document.createElement("p");
      p.className = "job-err";
      p.textContent = job.error || "Generation failed. Try adjusting your prompt.";
      tracksEl.append(p);
    } else {
      const list = job.tracks.length ? job.tracks : [null, null];
      list.forEach((t) => tracksEl.append(renderTrack(t, job)));
    }
    wrap.append(node);
  }
  markPlaying();
}

function renderTrack(t, job) {
  const node = $("#trackTpl").content.firstElementChild.cloneNode(true);
  if (!t) {
    node.classList.add("skeleton");
    $(".t-title", node).textContent = "Generating";
    $(".t-tags", node).textContent = "…";
    $(".t-dur", node).textContent = STATUS_LABEL[job.status] || "";
    $$(".icon-btn", node).forEach((b) => b.setAttribute("aria-disabled", "true"));
    $(".cover img", node).remove();
    return node;
  }
  node.dataset.id = t.id;
  const src = t.audioUrl || t.streamUrl;
  const img = $(".cover img", node);
  if (t.imageUrl) { img.onerror = () => img.remove(); img.src = t.imageUrl; } else img.remove();
  $(".t-title", node).textContent = t.title || job.label;
  $(".t-tags", node).textContent = t.tags || "";
  $(".t-dur", node).textContent = t.audioUrl ? fmtTime(t.duration) : "Streaming preview…";

  $(".cover", node).addEventListener("click", () => playTrack(t, job));

  const dl = $(".dl", node);
  if (t.audioUrl) {
    dl.href = t.audioUrl;
    dl.setAttribute("download", `${(t.title || "song").replace(/[^\w\- ]+/g, "")}.mp3`);
  } else dl.setAttribute("aria-disabled", "true");

  const lyrBtn = $(".lyr", node);
  const pre = $(".t-lyrics", node);
  if (t.prompt && !job.meta.includes("Instrumental")) {
    pre.textContent = t.prompt;
    pre.hidden = !openLyrics.has(t.id);
    lyrBtn.addEventListener("click", () => {
      pre.hidden = !pre.hidden;
      pre.hidden ? openLyrics.delete(t.id) : openLyrics.add(t.id);
    });
  } else lyrBtn.setAttribute("aria-disabled", "true");

  if (!src) $(".cover", node).disabled = true;
  return node;
}

// ---------- player ----------
const audio = $("#audio");
let current = null;

function playTrack(t, job) {
  const src = t.audioUrl || t.streamUrl;
  if (!src) return;
  if (current?.id === t.id) { audio.paused ? audio.play() : audio.pause(); return; }
  current = { id: t.id };
  audio.src = src;
  audio.play().catch(() => {});
  $("#player").hidden = false;
  $("#pTitle").textContent = t.title || job.label;
  $("#pTags").textContent = t.tags || "";
  const c = $("#pCover");
  c.onerror = () => (c.style.visibility = "hidden");
  if (t.imageUrl) { c.src = t.imageUrl; c.style.visibility = "visible"; } else c.style.visibility = "hidden";
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title || job.label, artist: "SongForge", artwork: t.imageUrl ? [{ src: t.imageUrl, sizes: "512x512" }] : [],
    });
  }
  markPlaying();
}

function markPlaying() {
  $$(".track").forEach((el) => el.classList.toggle("playing", !!current && el.dataset.id === current.id && !audio.paused));
}

function initPlayer() {
  const seek = $("#pSeek");
  let dragging = false;
  $("#pPlay").addEventListener("click", () => (audio.paused ? audio.play() : audio.pause()));
  audio.addEventListener("play", () => { $("#player").classList.add("is-playing"); markPlaying(); });
  audio.addEventListener("pause", () => { $("#player").classList.remove("is-playing"); markPlaying(); });
  audio.addEventListener("ended", () => { $("#player").classList.remove("is-playing"); markPlaying(); });
  audio.addEventListener("loadedmetadata", () => ($("#pDur").textContent = isFinite(audio.duration) ? fmtTime(audio.duration) : "Live"));
  audio.addEventListener("timeupdate", () => {
    $("#pCur").textContent = fmtTime(audio.currentTime);
    if (!dragging && isFinite(audio.duration) && audio.duration) seek.value = (audio.currentTime / audio.duration) * 100;
  });
  seek.addEventListener("input", () => (dragging = true));
  seek.addEventListener("change", () => {
    if (isFinite(audio.duration)) audio.currentTime = (seek.value / 100) * audio.duration;
    dragging = false;
  });
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(document.activeElement.tagName) && audio.src) {
      e.preventDefault(); audio.paused ? audio.play() : audio.pause();
    }
  });
}

// ---------- boot ----------
function init() {
  $$(".tab").forEach((t) => t.addEventListener("click", () => setMode(t.dataset.mode)));
  $("#instrumental").addEventListener("change", syncInstrumental);
  $("#genForm").addEventListener("submit", onGenerate);
  $("#lyricBtn").addEventListener("click", onWriteLyrics);
  $("#clearBtn").addEventListener("click", () => {
    if (!confirm("Remove all songs from your library? (This only clears this browser.)")) return;
    jobs = []; saveJobs(); render();
  });
  initChips(); initCounters(); initSliders(); initPlayer();
  render();
  refreshCredits();
  // Resume polling for any unfinished jobs from a previous visit.
  jobs.filter((j) => j.status !== "SUCCESS" && !FAILED.has(j.status)).forEach(poll);
  setInterval(() => jobs.length && render(), 60000);
}

init();
