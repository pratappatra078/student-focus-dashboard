"use strict";

/* ============================================================
   Helpers
   ============================================================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const pad = (n) => String(n).padStart(2, "0");

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
const saveJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const formatTime = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;

function formatMs(ms) {
  const cs = Math.floor((ms % 1000) / 10);
  const s = Math.floor((ms / 1000) % 60);
  const m = Math.floor(ms / 60000);
  return `${pad(m)}:${pad(s)}.${pad(cs)}`;
}

function formatHMS(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/* ============================================================
   Settings
   ============================================================ */
const DEFAULT_SETTINGS = { pomodoro: 25, short: 5, long: 50, target: 4, autoStart: false, sound: true, focusLock: true };
const settings = Object.assign({}, DEFAULT_SETTINGS, loadJSON("focusSettings", {}));
const saveSettings = () => saveJSON("focusSettings", settings);

/* ============================================================
   Toast
   ============================================================ */
let toastTimer;
function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

/* ============================================================
   Clock
   ============================================================ */
let is24Hour = localStorage.getItem("focus24h") === "1";

function updateClock() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  let html;
  if (is24Hour) {
    html = `${pad(hours)}:${minutes}:${seconds}`;
  } else {
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    html = `${hours}:${minutes}:${seconds}<span class="ampm">${ampm}</span>`;
  }
  $("#digital-clock").innerHTML = html;
  $("#zen-time").innerHTML = html;
  $("#date-display").textContent = dateStr;
  const toggle = $("#clock-toggle");
  toggle.textContent = is24Hour ? "24H" : "12H";
  toggle.setAttribute("aria-label", "Switch to " + (is24Hour ? "12-hour" : "24-hour") + " format");
}
setInterval(updateClock, 1000);

function toggleFormat() {
  is24Hour = !is24Hour;
  localStorage.setItem("focus24h", is24Hour ? "1" : "0");
  updateClock();
}

/* ============================================================
   Theme (light / dark)
   ============================================================ */
const THEME_STORAGE_KEY = "focusTheme";
const themeBtn = $("#theme-btn");
const prefersLight = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

function resolveTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return prefersLight && prefersLight.matches ? "light" : "dark";
}

function applyTheme(t) {
  const light = t === "light";
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", light ? "#eef1f6" : "#0a0b0d");
  const next = light ? "dark" : "light";
  themeBtn.title = "Switch to " + next + " mode";
  themeBtn.setAttribute("aria-label", "Switch to " + next + " mode");
}

function toggleTheme() {
  const next = resolveTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, next);
  applyTheme(next);
}

themeBtn.addEventListener("click", toggleTheme);
applyTheme(resolveTheme());
if (prefersLight) {
  const onSchemeChange = () => {
    if (!localStorage.getItem(THEME_STORAGE_KEY)) applyTheme(resolveTheme());
  };
  if (typeof prefersLight.addEventListener === "function") {
    prefersLight.addEventListener("change", onSchemeChange);
  } else if (typeof prefersLight.addListener === "function") {
    prefersLight.addListener(onSchemeChange);
  }
}

/* ============================================================
   Full-screen overlays
   ============================================================ */
let idleTimeout;

function resetIdleTimer() {
  const active = Array.from($$(".fs-overlay")).find((el) => el.style.display === "flex");
  if (!active) return;
  active.classList.remove("ui-hidden");
  clearTimeout(idleTimeout);
  idleTimeout = setTimeout(() => {
    if (active.style.display === "flex") active.classList.add("ui-hidden");
  }, 3000);
}

function openFullscreen(id) {
  const el = document.getElementById(id);
  el.style.display = "flex";
  el.dataset.mode = timer.mode;
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  resetIdleTimer();
}

function closeFullscreen() {
  $$(".fs-overlay").forEach((el) => {
    el.style.display = "none";
    el.classList.remove("ui-hidden");
  });
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

document.addEventListener("mousemove", resetIdleTimer);
document.addEventListener("touchstart", resetIdleTimer);
document.addEventListener("click", resetIdleTimer);
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    $$(".fs-overlay").forEach((el) => (el.style.display = "none"));
  }
});

function setupOverlayInteraction(id, singleClickAction) {
  const el = document.getElementById(id);
  let clickTimeout;
  el.addEventListener("click", () => {
    if (clickTimeout) clearTimeout(clickTimeout);
    clickTimeout = setTimeout(() => {
      if (singleClickAction) singleClickAction();
    }, 250);
  });
  el.addEventListener("dblclick", () => {
    clearTimeout(clickTimeout);
    closeFullscreen();
  });
}
setupOverlayInteraction("clock-overlay", null);
setupOverlayInteraction("timer-overlay", toggleTimer);
setupOverlayInteraction("stopwatch-overlay", toggleStopwatch);

/* ============================================================
   Focus statistics (per-day, localStorage)
   ============================================================ */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
let focusStore = loadJSON("focusStats", {});
let todayStat = null;

function ensureTodayStat() {
  const k = todayKey();
  if (focusStore[k]) {
    todayStat = focusStore[k];
    return;
  }
  for (const key of Object.keys(focusStore)) {
    if (Date.now() - new Date(key + "T00:00:00").getTime() > 10 * 864e5) delete focusStore[key];
  }
  todayStat = focusStore[k] = { seconds: 0, sessions: 0 };
}
function persistFocusStat() {
  saveJSON("focusStats", focusStore);
}
ensureTodayStat();

/* ============================================================
   Study Timer
   ============================================================ */
const timer = {
  mode: "focus",
  running: false,
  total: settings.pomodoro * 60,
  remaining: settings.pomodoro * 60,
  endAt: 0,
  interval: null,
  completed: 0,
};

function modeSeconds() {
  const m = { focus: settings.pomodoro, short: settings.short, long: settings.long }[timer.mode];
  return (m || 25) * 60;
}

/* ------------------------- Timer auto-save ------------------------- */
let lastTimerStateKey = "";

function saveTimerState() {
  const key = [timer.mode, timer.total, timer.remaining, timer.running, timer.endAt, timer.completed].join("|");
  if (key === lastTimerStateKey) return;
  lastTimerStateKey = key;
  saveJSON("focusTimerState", {
    mode: timer.mode,
    total: timer.total,
    remaining: timer.remaining,
    running: timer.running,
    endAt: timer.endAt,
    completed: timer.completed,
  });
}

function restoreTimerState() {
  const s = loadJSON("focusTimerState", null);
  if (!s) return;
  if (!["focus", "short", "long"].includes(s.mode)) s.mode = "focus";
  const dur = { focus: settings.pomodoro, short: settings.short, long: settings.long }[s.mode] * 60;
  timer.mode = s.mode;
  timer.total = dur;
  let rem = Number.isFinite(s.remaining) ? Math.round(s.remaining) : dur;
  if (s.running && Number.isFinite(s.endAt) && s.endAt > Date.now()) {
    rem = Math.round((s.endAt - Date.now()) / 1000);
  }
  timer.remaining = Math.max(0, Math.min(rem, dur));
  timer.completed = Math.max(0, Math.min(Math.round(s.completed || 0), settings.target));
  timer.running = false;
}
restoreTimerState();

const RING = $("#timer-ring-fill");
const RING_C = 2 * Math.PI * (parseFloat(RING.getAttribute("r")) || 62);

function updateTimerControls() {
  const btn = $("#timer-start");
  if (timer.running) {
    btn.textContent = "Pause";
    btn.className = "btn btn-warning";
  } else {
    btn.textContent = timer.remaining < timer.total ? "Resume" : "Start";
    btn.className = "btn btn-primary";
  }
  $$(".preset").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === timer.mode);
    b.disabled = timer.running && b.dataset.mode !== timer.mode;
  });
}

function updateFocusBadge() {
  const badge = $("#focus-badge");
  const text = badge.querySelector(".badge-text");
  if (timer.running && timer.mode === "focus") {
    badge.classList.add("is-active");
    text.textContent = "Focusing";
  } else if (timer.running) {
    badge.classList.remove("is-active");
    text.textContent = "On Break";
  } else {
    badge.classList.remove("is-active");
    text.textContent = "Focus Mode";
  }
}

function updateTimerDisplay() {
  const label = timer.mode === "focus" ? "FOCUS" : timer.mode === "long" ? "LONG BREAK" : "SHORT BREAK";
  $("#timer-mode").textContent = label;
  $("#focus-timer-mode").textContent = label;
  $("#timer-display").textContent = formatTime(timer.remaining);
  $("#focus-timer-large").textContent = formatTime(timer.remaining);
  $("#timer-circle").setAttribute(
    "aria-label",
    `${label} timer, ${timer.remaining} seconds remaining`
  );

  $("#timer-card").dataset.mode = timer.mode;
  $("#timer-overlay").dataset.mode = timer.mode;
  $("#timer-card").classList.toggle("is-running", timer.running);
  $("#timer-card").classList.toggle("is-paused", !timer.running && timer.remaining < timer.total);
  $("#focus-timer-large").classList.toggle("paused", !timer.running && timer.remaining < timer.total);

  const sessionText =
    timer.mode === "focus"
      ? `Session ${Math.min(timer.completed + 1, settings.target)} of ${settings.target}`
      : "Next: Focus";
  $("#session-count").textContent = sessionText;
  $("#focus-session-note").textContent = sessionText;

  RING.style.strokeDasharray = RING_C;
  RING.style.strokeDashoffset = RING_C * (1 - timer.remaining / timer.total);

  updateFocusBadge();
  updateTimerControls();
  saveTimerState();
}

function stopTimerTicks() {
  if (timer.interval) {
    clearInterval(timer.interval);
    timer.interval = null;
  }
}

let autoFullscreen = false;

function exitFocusFullscreen() {
  if (autoFullscreen && document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  autoFullscreen = false;
}

function startTimerTicks() {
  stopTimerTicks();
  timer.endAt = Date.now() + timer.remaining * 1000;
  timer.running = true;
  timer.interval = setInterval(tickTimer, 1000);
  if (timer.mode === "focus" && settings.focusLock && !document.fullscreenElement) {
    if (document.documentElement.requestFullscreen) {
      Promise.resolve(document.documentElement.requestFullscreen()).catch(() => {});
    }
    autoFullscreen = true;
  }
  updateTimerDisplay();
}

function tickTimer() {
  const rem = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
  const delta = timer.remaining - rem;
  timer.remaining = rem;
  if (timer.mode === "focus" && delta > 0) {
    ensureTodayStat();
    todayStat.seconds += delta;
    persistFocusStat();
    updateStats();
  }
  if (rem <= 0) {
    completeTimer();
    return;
  }
  updateTimerDisplay();
}

function toggleTimer() {
  if (timer.running) {
    stopTimerTicks();
    timer.running = false;
  } else if (timer.remaining > 0) {
    startTimerTicks();
  }
  updateTimerDisplay();
}

function setPreset(mode) {
  stopTimerTicks();
  timer.mode = mode;
  timer.total = modeSeconds();
  timer.remaining = timer.total;
  timer.running = false;
  updateTimerDisplay();
}

function resetTimer() {
  setPreset("focus");
}

function completeTimer() {
  stopTimerTicks();
  timer.running = false;
  let next = "focus";
  if (timer.mode === "focus") {
    ensureTodayStat();
    todayStat.sessions += 1;
    persistFocusStat();
    timer.completed += 1;
    const longCycle = timer.completed >= settings.target;
    if (longCycle) timer.completed = 0;
    next = longCycle ? "long" : "short";
    if (settings.sound) playAlarm();
    showToast(longCycle ? "Focus complete! Time for a long break." : "Focus complete! Time for a short break.");
  } else {
    next = "focus";
    if (settings.sound) playAlarm();
    showToast("Break finished — back to focus!");
  }
  exitFocusFullscreen();
  setPreset(next);
  updateStats();
  if (settings.autoStart) toggleTimer();
}

function quitFocusMode() {
  if (timer.running) stopTimerTicks();
  timer.running = false;
  exitFocusFullscreen();
  updateTimerDisplay();
  showToast("Focus session cancelled — stay strong next time!");
}

function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    /* audio unavailable */
  }
  if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
}

/* ============================================================
   Daily progress
   ============================================================ */
function computeProductivity(done, total) {
  const FOCUS_GOAL = 2 * 3600;
  const focusPct = Math.min(1, todayStat.seconds / FOCUS_GOAL);
  const taskPct = total ? done / total : 0;
  return Math.round((focusPct * 0.6 + taskPct * 0.4) * 100);
}

function updateStats() {
  ensureTodayStat();
  $("#total-focus").textContent = formatHMS(todayStat.seconds);
  $("#timer-today-focus").textContent = formatHMS(todayStat.seconds);
  const done = tasks.filter((t) => t.done).length;
  $("#tasks-count").textContent = `${done} / ${tasks.length}`;
  $("#pomodoros-count").textContent = String(todayStat.sessions);

  const pct = computeProductivity(done, tasks.length);
  $("#progress-pct").textContent = `${pct}%`;
  $("#daily-progress-fill").style.width = pct + "%";
  $("#daily-progress-bar").setAttribute("aria-valuenow", pct);

  const tPct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  $("#task-progress-fill").style.width = tPct + "%";
  $("#task-progress-bar").setAttribute("aria-valuenow", tPct);
  $("#task-progress-label").textContent = `${done} / ${tasks.length} tasks completed`;
}

/* ============================================================
   Stopwatch
   ============================================================ */
const sw = { running: false, start: 0, elapsed: 0, interval: null, laps: [], last: 0 };
const swDiff = () => sw.elapsed + (sw.running ? Date.now() - sw.start : 0);

function renderStopwatch() {
  const str = formatMs(swDiff());
  $("#stopwatch-display").textContent = str;
  $("#stopwatch-large").textContent = str;
  $("#stopwatch-large").classList.toggle("paused", !sw.running && swDiff() > 0);
}

function updateSwControls() {
  const btn = $("#sw-start");
  btn.textContent = sw.running ? "Pause" : "Start";
  btn.className = sw.running ? "btn btn-warning" : "btn btn-primary";
  $("#sw-lap").disabled = !sw.running && swDiff() === 0;
}

function stopSwTicks() {
  if (sw.interval) {
    clearInterval(sw.interval);
    sw.interval = null;
  }
}

function toggleStopwatch() {
  if (sw.running) {
    sw.elapsed = swDiff();
    stopSwTicks();
  } else {
    sw.start = Date.now();
    sw.interval = setInterval(renderStopwatch, 50);
  }
  sw.running = !sw.running;
  updateSwControls();
  renderStopwatch();
}

function resetStopwatch() {
  stopSwTicks();
  sw.running = false;
  sw.elapsed = 0;
  sw.start = 0;
  sw.laps = [];
  sw.last = 0;
  $("#stopwatch-large").classList.remove("paused");
  renderStopwatch();
  updateSwControls();
  renderLaps();
}

function recordLap() {
  const diff = swDiff();
  if (diff === 0) return;
  sw.laps.push({ split: diff - sw.last, total: diff });
  sw.last = diff;
  renderLaps();
}

function clearLaps() {
  sw.laps = [];
  sw.last = 0;
  renderLaps();
}

function renderLaps() {
  const box = $("#laps-list");
  box.innerHTML = "";
  if (!sw.laps.length) {
    const empty = document.createElement("div");
    empty.className = "lap-empty";
    empty.textContent = "No laps yet — press Lap while timing.";
    box.appendChild(empty);
    $("#clear-laps").disabled = true;
    return;
  }
  $("#clear-laps").disabled = false;
  const frag = document.createDocumentFragment();
  sw.laps.slice().reverse().forEach((lap, i) => {
    const num = sw.laps.length - i;
    const row = document.createElement("div");
    row.className = "lap-item";
    const n = document.createElement("span");
    n.className = "lap-num";
    n.textContent = `Lap ${num}`;
    const split = document.createElement("span");
    split.className = "lap-split";
    split.textContent = "+" + formatMs(lap.split);
    const total = document.createElement("span");
    total.className = "lap-total";
    total.textContent = formatMs(lap.total);
    row.append(n, split, total);
    frag.appendChild(row);
  });
  box.appendChild(frag);
}

/* ============================================================
   Tasks
   ============================================================ */
const PENCIL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
const TRASH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

let tasks = loadJSON("studentTasks", []);
let taskFilter = "all";

const priorityRank = (p) => (p === "high" ? 0 : p === "medium" ? 1 : 2);

const persistTasks = () => saveJSON("studentTasks", tasks);

function sortTasks() {
  tasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const r = priorityRank(a.priority) - priorityRank(b.priority);
    if (r !== 0) return r;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

function buildTaskItem(t) {
  const li = document.createElement("li");
  li.className = `todo-item priority-${t.priority || "medium"}${t.done ? " completed" : ""}`;
  li.dataset.id = t.id;

  const checkLabel = document.createElement("label");
  checkLabel.className = "todo-check";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = t.done;
  cb.setAttribute("aria-label", `Mark "${t.text}" ${t.done ? "active" : "complete"}`);
  checkLabel.appendChild(cb);

  const main = document.createElement("div");
  main.className = "todo-main";
  if (t.sub) {
    const tag = document.createElement("span");
    tag.className = "subject-tag";
    tag.textContent = t.sub;
    main.appendChild(tag);
  }
  const txt = document.createElement("span");
  txt.className = "todo-text";
  txt.textContent = t.text;
  main.appendChild(txt);

  const actions = document.createElement("div");
  actions.className = "todo-actions";
  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "icon-btn todo-edit";
  editBtn.title = "Edit task";
  editBtn.setAttribute("aria-label", `Edit task: ${t.text}`);
  editBtn.innerHTML = PENCIL_SVG;
  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "icon-btn todo-delete";
  delBtn.title = "Delete task";
  delBtn.setAttribute("aria-label", `Delete task: ${t.text}`);
  delBtn.innerHTML = TRASH_SVG;
  actions.append(editBtn, delBtn);

  li.append(checkLabel, main, actions);
  return li;
}

function renderTasks() {
  sortTasks();
  const list = $("#todo-list");
  const visible = tasks.filter((t) =>
    taskFilter === "all" ? true : taskFilter === "active" ? !t.done : t.done
  );
  list.innerHTML = "";
  if (!visible.length) {
    const li = document.createElement("li");
    li.className = "todo-empty";
    li.textContent =
      taskFilter === "all"
        ? "No tasks yet — add your first task above."
        : taskFilter === "active"
          ? "No active tasks right now."
          : "No completed tasks yet.";
    list.appendChild(li);
  } else {
    const frag = document.createDocumentFragment();
    visible.forEach((t) => frag.appendChild(buildTaskItem(t)));
    list.appendChild(frag);
  }
  updateStats();
  persistTasks();
}

function addTask() {
  const textInput = $("#task-input");
  const text = textInput.value.trim();
  if (!text) return;
  tasks.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    sub: $("#subject-input").value.trim().toUpperCase(),
    priority: $("#priority-input").value,
    done: false,
    createdAt: Date.now(),
  });
  textInput.value = "";
  $("#subject-input").value = "";
  textInput.focus();
  renderTasks();
}

function focusTaskInput() {
  $("#task-input").focus();
}

function editTask(t, li) {
  const main = li.querySelector(".todo-main");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "todo-edit-input";
  input.value = t.text;
  input.maxLength = 300;
  input.setAttribute("aria-label", "Edit task text");
  main.replaceChildren(input);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  let closed = false;
  const commit = () => {
    if (closed) return;
    closed = true;
    const v = input.value.trim();
    if (v) t.text = v;
    renderTasks();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      closed = true;
      renderTasks();
    }
  });
  input.addEventListener("blur", commit);
}

$("#todo-list").addEventListener("click", (e) => {
  const li = e.target.closest(".todo-item");
  if (!li) return;
  const t = tasks.find((x) => x.id === li.dataset.id);
  if (!t) return;
  if (e.target.closest(".todo-edit")) {
    editTask(t, li);
  } else if (e.target.closest(".todo-delete")) {
    tasks = tasks.filter((x) => x.id !== t.id);
    renderTasks();
    showToast("Task deleted");
  } else if (e.target.matches(".todo-check input")) {
    t.done = e.target.checked;
    renderTasks();
  }
});

$(".task-filters").addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;
  taskFilter = btn.dataset.filter;
  $$(".filter-btn").forEach((b) => b.classList.toggle("active", b === btn));
  renderTasks();
});

$("#add-task-btn").addEventListener("click", addTask);
["task-input", "subject-input"].forEach((id) => {
  $("#" + id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTask();
    }
  });
});

/* ============================================================
   Quick Notes
   ============================================================ */
const notesArea = $("#notes-area");
const noteStatus = $("#note-status");
let notesDebounce = null;
let notesSavedAt = Date.now();

notesArea.value = localStorage.getItem("studentNotes") || "";

function persistNotes() {
  localStorage.setItem("studentNotes", notesArea.value);
}

function updateNoteCount() {
  $("#note-count").textContent = `${notesArea.value.length} chars`;
}

function noteSavedTime() {
  if (Date.now() - notesSavedAt < 8e3) return "Saved just now";
  return `Saved ${new Date(notesSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function flashStatus(text, sticky) {
  noteStatus.textContent = text;
  clearTimeout(flashStatus._t);
  if (!sticky) flashStatus._t = setTimeout(() => (noteStatus.textContent = noteSavedTime()), 2600);
}

notesArea.addEventListener("input", () => {
  updateNoteCount();
  flashStatus("Saving…", true);
  clearTimeout(notesDebounce);
  notesDebounce = setTimeout(() => {
    persistNotes();
    notesSavedAt = Date.now();
    flashStatus("Saved just now");
  }, 400);
});

function clearNotes() {
  askConfirm("Clear notes?", "This permanently deletes everything in your notes.", "Clear", () => {
    notesArea.value = "";
    persistNotes();
    notesSavedAt = Date.now();
    updateNoteCount();
    flashStatus("Notes cleared");
    notesArea.focus();
  });
}

window.addEventListener("beforeunload", () => {
  if (notesArea.value !== localStorage.getItem("studentNotes")) persistNotes();
});

/* ============================================================
   Dialogs
   ============================================================ */
const settingsDialog = $("#settings-dialog");
const confirmDialog = $("#confirm-dialog");
let confirmAction = null;

function openSettings() {
  $("#set-pomodoro").value = settings.pomodoro;
  $("#set-short").value = settings.short;
  $("#set-long").value = settings.long;
  $("#set-target").value = settings.target;
  $("#set-autostart").checked = settings.autoStart;
  $("#set-sound").checked = settings.sound;
  $("#set-focuslock").checked = settings.focusLock;
  settingsDialog.showModal();
}
$("#settings-btn").addEventListener("click", openSettings);

function clampNum(sel, min, max, def) {
  const n = Math.round(Number($(sel).value));
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

settingsDialog.addEventListener("close", () => {
  if (settingsDialog.returnValue === "save") {
    settings.pomodoro = clampNum("#set-pomodoro", 1, 180, 25);
    settings.short = clampNum("#set-short", 1, 120, 5);
    settings.long = clampNum("#set-long", 1, 180, 50);
    settings.target = clampNum("#set-target", 1, 12, 4);
    settings.autoStart = $("#set-autostart").checked;
    settings.sound = $("#set-sound").checked;
    settings.focusLock = $("#set-focuslock").checked;
    saveSettings();
    if (!timer.running) {
      timer.total = modeSeconds();
      timer.remaining = timer.total;
    }
    updateTimerDisplay();
    showToast("Settings saved");
  }
  settingsDialog.returnValue = "";
});

function askConfirm(title, message, okLabel, cb) {
  $("#confirm-title").textContent = title;
  $("#confirm-message").textContent = message;
  $("#confirm-ok").textContent = okLabel;
  confirmAction = cb;
  confirmDialog.showModal();
}
confirmDialog.addEventListener("close", () => {
  if (confirmDialog.returnValue === "ok" && confirmAction) confirmAction();
  confirmDialog.returnValue = "";
  confirmAction = null;
});

/* ============================================================
   Focus lock (full screen + leave warning)
   ============================================================ */
const focusWarnDialog = $("#focus-warn-dialog");
let focusWarnOpen = false;
let lastLeaveWarn = 0;

function warnFocusLeave() {
  if (!(settings.focusLock && timer.running && timer.mode === "focus")) return;
  if (focusWarnOpen || Date.now() - lastLeaveWarn < 3000) return;
  focusWarnOpen = true;
  if (settings.sound) playAlarm();
  focusWarnDialog.showModal();
}

focusWarnDialog.addEventListener("close", () => {
  const v = focusWarnDialog.returnValue;
  focusWarnDialog.returnValue = "";
  focusWarnOpen = false;
  if (v === "quit") {
    quitFocusMode();
  } else if (v === "stay") {
    lastLeaveWarn = Date.now();
    if (timer.running && timer.mode === "focus") showToast("Welcome back — stay focused!");
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") warnFocusLeave();
});
window.addEventListener("blur", warnFocusLeave);
window.addEventListener("beforeunload", (e) => {
  if (settings.focusLock && timer.running && timer.mode === "focus") {
    e.preventDefault();
    e.returnValue = "";
  }
});

/* ============================================================
   Keyboard shortcuts
   ============================================================ */
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    persistNotes();
    notesSavedAt = Date.now();
    flashStatus("Saved just now");
    return;
  }
  if (settingsDialog.open || confirmDialog.open || focusWarnDialog.open) return;
  const el = e.target || document.body;
  if (el.matches && el.matches("input, textarea, select")) return;
  if (el.isContentEditable) return;
  if (el.tagName === "BUTTON" || el.tagName === "A") return;
  switch (e.key) {
    case " ":
    case "Spacebar":
      e.preventDefault();
      toggleTimer();
      break;
    case "r":
    case "R":
      resetTimer();
      showToast("Timer reset");
      break;
    case "n":
    case "N":
      e.preventDefault();
      focusTaskInput();
      break;
  }
});

/* ============================================================
   Init
   ============================================================ */
setInterval(() => {
  ensureTodayStat();
  updateStats();
}, 60000);

updateClock();
updateTimerDisplay();
updateStats();
renderStopwatch();
updateSwControls();
renderLaps();
renderTasks();
updateNoteCount();