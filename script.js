// --- Full Screen & Interaction Logic ---
let idleTimeout;

function openFullscreen(id) {
  document.getElementById(id).style.display = "flex";
  document.documentElement.requestFullscreen().catch((e) => {});
  resetIdleTimer(); // Start the timer immediately
}

function closeFullscreen() {
  document.querySelectorAll(".fs-overlay").forEach((el) => {
    el.style.display = "none";
    el.classList.remove("ui-hidden"); // Ensure UI is visible next time
  });
  if (document.fullscreenElement) {
    document.exitFullscreen().catch((e) => {});
  }
}

// --- Idle Detection for Cursor/Text Hiding ---
function resetIdleTimer() {
  const activeOverlay = document.querySelector('.fs-overlay[style*="flex"]');

  if (activeOverlay) {
    // Show UI
    activeOverlay.classList.remove("ui-hidden");

    // Clear existing timeout
    clearTimeout(idleTimeout);

    // Set new timeout (3 seconds)
    idleTimeout = setTimeout(() => {
      // Only hide if we are still in an overlay
      if (activeOverlay.style.display === "flex") {
        activeOverlay.classList.add("ui-hidden");
      }
    }, 3000);
  }
}

// Listen for user activity
document.addEventListener("mousemove", resetIdleTimer);
document.addEventListener("touchstart", resetIdleTimer);
document.addEventListener("click", resetIdleTimer);

// Handle ESC Key properly
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    document
      .querySelectorAll(".fs-overlay")
      .forEach((el) => (el.style.display = "none"));
  }
});

// Setup Single vs Double Click Logic
function setupOverlayInteraction(id, singleClickAction) {
  const el = document.getElementById(id);
  let clickTimeout;

  el.addEventListener("click", (e) => {
    if (clickTimeout) clearTimeout(clickTimeout);
    clickTimeout = setTimeout(() => {
      if (singleClickAction) singleClickAction();
    }, 250);
  });

  el.addEventListener("dblclick", (e) => {
    clearTimeout(clickTimeout);
    closeFullscreen();
  });
}

setupOverlayInteraction("clock-overlay", null);
setupOverlayInteraction("timer-overlay", toggleTimer);
setupOverlayInteraction("stopwatch-overlay", toggleStopwatch);

// --- Clock Logic ---
let is24Hour = false;
function updateClock() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  let timeHTML = "";

  if (!is24Hour) {
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    timeHTML = `${hours}:${minutes}:${seconds}<span class="ampm">${ampm}</span>`;
  } else {
    timeHTML = `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`;
  }

  document.getElementById("digital-clock").innerHTML = timeHTML;
  document.getElementById("zen-time").innerHTML = timeHTML;
  document.getElementById("date-display").innerText = dateStr;
}
setInterval(updateClock, 1000);
function toggleFormat() {
  is24Hour = !is24Hour;
  updateClock();
}

// --- Timer / Pomodoro Logic ---
let timerInterval,
  timerTime = 25 * 60,
  timerRunning = false;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function updateTimerDisplay() {
  const str = formatTime(timerTime);
  document.getElementById("timer-display").innerText = str;
  document.getElementById("focus-timer-large").innerText = str;
}

function toggleTimer() {
  const fsText = document.getElementById("focus-timer-large");
  if (timerRunning) {
    clearInterval(timerInterval);
    document.getElementById("timer-start").innerText = "Resume";
    fsText.classList.add("paused");
  } else {
    timerInterval = setInterval(() => {
      if (timerTime > 0) {
        timerTime--;
        updateTimerDisplay();
      } else {
        clearInterval(timerInterval);
        playAlarm();
        alert("Time's Up!");
      }
    }, 1000);
    document.getElementById("timer-start").innerText = "Pause";
    fsText.classList.remove("paused");
  }
  timerRunning = !timerRunning;
}

function setTimer(m) {
  clearInterval(timerInterval);
  timerRunning = false;
  timerTime = m * 60;
  updateTimerDisplay();
  document.getElementById("timer-start").innerText = "Start";
  document.getElementById("focus-timer-large").classList.remove("paused");
}
function resetTimer() {
  setTimer(25);
}

function playAlarm() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

// --- Stopwatch Logic ---
let swInterval,
  swStart,
  swElapsed = 0,
  swRunning = false;
function updateStopwatch() {
  const diff = Date.now() - swStart + swElapsed;
  const ms = Math.floor((diff % 1000) / 10);
  const s = Math.floor((diff / 1000) % 60);
  const m = Math.floor(diff / (1000 * 60));
  const str = `${String(m).padStart(2, "0")}:${String(s).padStart(
    2,
    "0"
  )}.${String(ms).padStart(2, "0")}`;
  document.getElementById("stopwatch-display").innerText = str;
  document.getElementById("stopwatch-large").innerText = str;
}
function toggleStopwatch() {
  const fsText = document.getElementById("stopwatch-large");
  if (swRunning) {
    clearInterval(swInterval);
    swElapsed += Date.now() - swStart;
    document.getElementById("sw-start").innerText = "Start";
    document.getElementById("sw-start").className = "btn btn-primary";
    fsText.classList.add("paused");
  } else {
    swStart = Date.now();
    swInterval = setInterval(updateStopwatch, 10);
    document.getElementById("sw-start").innerText = "Pause";
    document.getElementById("sw-start").className = "btn btn-danger";
    fsText.classList.remove("paused");
  }
  swRunning = !swRunning;
}
function resetStopwatch() {
  clearInterval(swInterval);
  swRunning = false;
  swElapsed = 0;
  document.getElementById("stopwatch-display").innerText = "00:00.00";
  document.getElementById("stopwatch-large").innerText = "00:00.00";
  document.getElementById("laps-list").innerHTML = "";
  document.getElementById("sw-start").innerText = "Start";
  document.getElementById("stopwatch-large").classList.remove("paused");
}
function recordLap() {
  if (!swRunning && swElapsed === 0) return;
  const li = document.createElement("div");
  li.className = "lap-item";
  li.innerHTML = `<span>Lap ${
    document.getElementById("laps-list").children.length + 1
  }</span> <span>${
    document.getElementById("stopwatch-display").innerText
  }</span>`;
  document.getElementById("laps-list").prepend(li);
}

// --- To-Do & Notes ---
let tasks = JSON.parse(localStorage.getItem("studentTasks")) || [];
function renderTasks() {
  const list = document.getElementById("todo-list");
  list.innerHTML = "";
  let c = 0;
  tasks.forEach((t, i) => {
    if (t.done) c++;
    list.innerHTML += `<li class="todo-item ${t.done ? "completed" : ""}">
                    <input type="checkbox" ${
                      t.done ? "checked" : ""
                    } onclick="toggleTask(${i})">
                    <span><span class="subject-tag">${t.sub || "Gen"}</span> ${
      t.text
    }</span>
                    <button onclick="deleteTask(${i})" style="background:none; border:none; color:#555;">&times;</button>
                </li>`;
  });
  document.getElementById("progress-fill").style.width = tasks.length
    ? `${(c / tasks.length) * 100}%`
    : "0%";
  localStorage.setItem("studentTasks", JSON.stringify(tasks));
}
function addTask() {
  const t = document.getElementById("task-input"),
    s = document.getElementById("subject-input");
  if (t.value.trim()) {
    tasks.push({ text: t.value, sub: s.value, done: false });
    t.value = "";
    s.value = "";
    renderTasks();
  }
}
function toggleTask(i) {
  tasks[i].done = !tasks[i].done;
  renderTasks();
}
function deleteTask(i) {
  tasks.splice(i, 1);
  renderTasks();
}

const na = document.getElementById("notes-area");
na.value = localStorage.getItem("studentNotes") || "";
na.addEventListener("input", () => {
  localStorage.setItem("studentNotes", na.value);
  document.getElementById("save-status").innerText = "Saving...";
  setTimeout(
    () => (document.getElementById("save-status").innerText = "Saved"),
    500
  );
});

renderTasks();
updateClock();
