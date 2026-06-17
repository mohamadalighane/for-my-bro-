// ─── Tehran utilities ────────────────────────────────────────────────────
function getTehranNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tehran" }));
}
function getTehranDateKey(date) {
  const d = date || getTehranNow();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getMsUntilMidnight() {
  const now = getTehranNow();
  const tm = new Date(now);
  tm.setDate(now.getDate()+1); tm.setHours(0,0,0,0);
  return tm - now;
}
function getTimeStr(date) {
  return (date||getTehranNow()).toLocaleTimeString("fa-IR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
}

// ─── Storage ─────────────────────────────────────────────────────────────
const store = {
  get(k) { try { const v=localStorage.getItem(k); return v?JSON.parse(v):null; } catch { return null; } },
  set(k,v) { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} }
};

// ─── Constants ────────────────────────────────────────────────────────────
const DAYS_FA = ["ش","ی","د","س","چ","پ","ج"];
const MONTHS_FA = ["فرو","ارد","خرد","تیر","مرد","شهر","مهر","آبا","آذر","دی","بهم","اسف"];

const DEFAULT_TASKS = [
  {id:"1",name:"مطالعه",stars:3},
  {id:"2",name:"ورزش",stars:5},
  {id:"3",name:"کار پروژه",stars:4},
  {id:"4",name:"مدیتیشن",stars:2},
  {id:"5",name:"مطالعه کتاب",stars:3},
];
const PRESET_REMINDERS = [
  {id:"r1",label:"شروع روز",time:"07:00",emoji:"🌅",active:true},
  {id:"r2",label:"چک میانه روز",time:"13:00",emoji:"☀️",active:false},
  {id:"r3",label:"مرور عصر",time:"18:00",emoji:"🌆",active:false},
  {id:"r4",label:"ذخیره شب",time:"23:59",emoji:"🌙",active:true,readonly:true,note:"خودکار — قبل از ۱۲ شب تهران"},
];

// ─── State ────────────────────────────────────────────────────────────────
let tasks      = store.get("pl-tasks") || DEFAULT_TASKS;
let todayKey   = getTehranDateKey();
let checked    = store.get("pl-checked-"+todayKey) || {};
let weekData   = store.get("pl-weekdata") || {};
let lastSave   = store.get("pl-lastsave") || null;
let reminders  = store.get("pl-reminders") || PRESET_REMINDERS;
let newStars   = 3;
let chartMode  = "weekly";
let chartInst  = null;
let prevDay    = todayKey;

// ─── Star Picker ──────────────────────────────────────────────────────────
function buildStarSVG(fill, size) {
  const uid = Math.random().toString(36).slice(2,8);
  const pts = "10,2 12.4,7.5 18.5,8 14,12.5 15.5,18.5 10,15.5 4.5,18.5 6,12.5 1.5,8 7.6,7.5";
  const leftFill  = fill >= 0.5 ? `<polygon points="${pts}" fill="#fbbf24" clip-path="url(#lc${uid})"/>` : "";
  const rightFill = fill >= 1   ? `<polygon points="${pts}" fill="#fbbf24" clip-path="url(#rc${uid})"/>` : "";
  return `<svg class="star-svg" width="${size}" height="${size}" viewBox="0 0 20 20">
    <defs>
      <clipPath id="lc${uid}"><rect x="0" y="0" width="10" height="20"/></clipPath>
      <clipPath id="rc${uid}"><rect x="10" y="0" width="10" height="20"/></clipPath>
    </defs>
    <polygon points="${pts}" fill="rgba(255,255,255,0.18)"/>
    ${leftFill}${rightFill}
  </svg>`;
}

function renderStarPicker(container, value, size, onChange) {
  container.innerHTML = "";
  for (let s = 1; s <= 5; s++) {
    const fill = value >= s ? 1 : value >= s-0.5 ? 0.5 : 0;
    const wrap = document.createElement("span");
    wrap.className = "star-half-wrap";
    wrap.style.width = size + "px";
    wrap.style.height = size + "px";
    wrap.innerHTML = buildStarSVG(fill, size);

    const left  = document.createElement("span"); left.className  = "star-left";
    const right = document.createElement("span"); right.className = "star-right";

    left.addEventListener("click",  e => { e.stopPropagation(); onChange(s - 0.5); });
    right.addEventListener("click", e => { e.stopPropagation(); onChange(s); });
    left.addEventListener("mouseenter",  () => renderStarPicker(container, s-0.5, size, onChange));
    right.addEventListener("mouseenter", () => renderStarPicker(container, s, size, onChange));
    wrap.addEventListener("mouseleave",  () => {
      const cur = parseFloat(container.dataset.value) || value;
      renderStarPicker(container, cur, size, onChange);
    });

    wrap.appendChild(left);
    wrap.appendChild(right);
    container.appendChild(wrap);
  }
}

// ─── Progress ─────────────────────────────────────────────────────────────
function calcProgress() {
  const total  = tasks.reduce((s,t) => s + t.stars, 0);
  const done   = tasks.filter(t => checked[t.id]).reduce((s,t) => s + t.stars, 0);
  const pct    = total > 0 ? Math.round((done/total)*100) : 0;
  return { total, done, pct, doneCount: tasks.filter(t=>checked[t.id]).length };
}

function updateProgress() {
  const { total, done, pct, doneCount } = calcProgress();
  const circ = 2 * Math.PI * 42;
  document.getElementById("ringArc").setAttribute("stroke-dashoffset", circ*(1-pct/100));
  document.getElementById("ringPct").textContent = pct + "%";
  document.getElementById("infoCount").textContent = `${doneCount} از ${tasks.length} کار`;
  document.getElementById("infoStars").textContent = `${done} از ${total} ستاره`;
  const msg = pct===100 ? "🎉 آفرین! همه کارها انجام شد"
            : pct>=70   ? "💪 عالی پیش می‌ری!"
            : pct>=40   ? "⚡ ادامه بده!"
            :             "🌅 روزت رو شروع کن!";
  document.getElementById("infoMsg").textContent = msg;
}

// ─── Tasks ────────────────────────────────────────────────────────────────
function saveTasks()   { store.set("pl-tasks", tasks); }
function saveChecked() { store.set("pl-checked-"+todayKey, checked); saveProgress(false); }

function renderTasks() {
  const list = document.getElementById("taskList");
  list.innerHTML = "";
  tasks.forEach(task => {
    const row = document.createElement("div");
    row.className = "task-item";

    // Checkbox
    const chk = document.createElement("div");
    chk.className = "task-check" + (checked[task.id] ? " done" : "");
    chk.addEventListener("click", () => {
      checked[task.id] = !checked[task.id];
      saveChecked();
      renderTasks();
      updateProgress();
    });

    // Name
    const nm = document.createElement("span");
    nm.className = "task-name" + (checked[task.id] ? " done" : "");
    nm.textContent = task.name;
    nm.addEventListener("dblclick", () => startEdit(task, nm, row));

    // Stars
    const stWrap = document.createElement("div"); stWrap.className = "task-stars-wrap";
    const picker = document.createElement("div"); picker.className = "star-picker";
    picker.dataset.value = task.stars;
    renderStarPicker(picker, task.stars, 20, v => {
      task.stars = v; picker.dataset.value = v;
      coeff.textContent = "ضریب: " + v;
      saveTasks(); updateProgress();
      renderStarPicker(picker, v, 20, () => {});
    });
    const coeff = document.createElement("span"); coeff.className = "star-coeff";
    coeff.textContent = "ضریب: " + task.stars;
    stWrap.appendChild(picker); stWrap.appendChild(coeff);

    // Delete
    const del = document.createElement("button"); del.className = "task-del"; del.textContent = "×";
    del.addEventListener("click", () => {
      tasks = tasks.filter(t => t.id !== task.id);
      delete checked[task.id];
      saveTasks(); saveChecked(); renderTasks(); updateProgress();
    });

    row.appendChild(chk); row.appendChild(nm); row.appendChild(stWrap); row.appendChild(del);
    list.appendChild(row);
  });
}

function startEdit(task, nameEl, row) {
  const input = document.createElement("input");
  input.className = "task-name-input";
  input.value = task.name;
  row.replaceChild(input, nameEl);
  input.focus();
  const finish = () => {
    const v = input.value.trim();
    if (v) { task.name = v; saveTasks(); }
    renderTasks();
  };
  input.addEventListener("blur", finish);
  input.addEventListener("keydown", e => e.key === "Enter" && finish());
}

function addTask() {
  const inp = document.getElementById("newTaskInput");
  const name = inp.value.trim(); if (!name) return;
  tasks.push({ id: Date.now().toString(), name, stars: newStars });
  inp.value = "";
  saveTasks(); renderTasks(); updateProgress();
}

// ─── New star picker (bottom) ─────────────────────────────────────────────
function initNewStarPicker() {
  const el = document.getElementById("newStarPicker");
  el.dataset.value = newStars;
  renderStarPicker(el, newStars, 22, v => {
    newStars = v; el.dataset.value = v;
    document.getElementById("newStarCount").textContent = v + " ستاره";
    renderStarPicker(el, v, 22, () => {});
  });
}

// ─── Save progress ────────────────────────────────────────────────────────
function saveProgress(isAuto) {
  const { pct } = calcProgress();
  weekData[todayKey] = pct;
  store.set("pl-weekdata", weekData);
  if (isAuto) {
    const info = todayKey + " — " + getTimeStr();
    lastSave = info; store.set("pl-lastsave", info);
    document.getElementById("lastSaveInfo").textContent = "آخرین ذخیره: " + info;
    const fl = document.getElementById("saveFlash");
    fl.classList.remove("hidden");
    setTimeout(() => fl.classList.add("hidden"), 3000);
  }
}

// ─── Scheduler / Reminders ───────────────────────────────────────────────
function saveReminders() { store.set("pl-reminders", reminders); }

function renderReminders() {
  const list = document.getElementById("reminderList");
  list.innerHTML = "";
  reminders.forEach(r => {
    const row = document.createElement("div");
    row.className = "reminder-item" + (r.active ? "" : " inactive");

    const em = document.createElement("span"); em.className = "reminder-emoji"; em.textContent = r.emoji;

    const info = document.createElement("div"); info.className = "reminder-info";
    const lbl = document.createElement("div"); lbl.className = "reminder-label"; lbl.textContent = r.label;
    info.appendChild(lbl);
    if (r.note) { const nt = document.createElement("div"); nt.className = "reminder-note"; nt.textContent = r.note; info.appendChild(nt); }

    const tm = document.createElement("div"); tm.className = "reminder-time"; tm.textContent = r.time;

    const tog = document.createElement("div");
    tog.className = "toggle" + (r.active?" on":"") + (r.readonly?" readonly":"");
    const knob = document.createElement("div"); knob.className = "toggle-knob";
    tog.appendChild(knob);
    if (!r.readonly) {
      tog.addEventListener("click", () => {
        r.active = !r.active; saveReminders(); renderReminders();
        document.getElementById("activeCount").textContent = reminders.filter(x=>x.active).length + " فعال";
      });
    }

    row.appendChild(em); row.appendChild(info); row.appendChild(tm); row.appendChild(tog);

    if (!r.readonly) {
      const del = document.createElement("button"); del.className = "reminder-del"; del.textContent = "×";
      del.addEventListener("click", () => {
        reminders = reminders.filter(x => x.id !== r.id);
        saveReminders(); renderReminders();
        document.getElementById("activeCount").textContent = reminders.filter(x=>x.active).length + " فعال";
      });
      row.appendChild(del);
    }
    list.appendChild(row);
  });
  document.getElementById("activeCount").textContent = reminders.filter(r=>r.active).length + " فعال";
  if (lastSave) document.getElementById("lastSaveInfo").textContent = "آخرین ذخیره: " + lastSave;
}

function addReminder() {
  const lbl  = document.getElementById("customLabelInput").value.trim() || "یادآور";
  const time = document.getElementById("customTimeInput").value;
  if (!time) return;
  reminders.push({ id: Date.now().toString(), label: lbl, time, emoji: "⏰", active: true });
  saveReminders(); renderReminders();
  document.getElementById("customLabelInput").value = "";
  document.getElementById("customTimeInput").value = "";
  const btn = document.getElementById("addReminderBtn");
  btn.textContent = "✓ اضافه شد"; btn.classList.add("added");
  setTimeout(() => { btn.textContent = "+ افزودن یادآور"; btn.classList.remove("added"); }, 1500);
}

// ─── Chart ────────────────────────────────────────────────────────────────
function getWeekDates() {
  const t = getTehranNow();
  return Array.from({length:7},(_,i)=>{ const d=new Date(t); d.setDate(t.getDate()-6+i); return getTehranDateKey(d); });
}
function getMonthDates() {
  const t = getTehranNow();
  return Array.from({length:30},(_,i)=>{ const d=new Date(t); d.setDate(t.getDate()-29+i); return getTehranDateKey(d); });
}
function getYearMonths() {
  const t = getTehranNow();
  return Array.from({length:12},(_,i)=>{ const d=new Date(t); d.setMonth(t.getMonth()-11+i); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; });
}

function buildChartData() {
  const { pct } = calcProgress();
  if (chartMode === "weekly") {
    const dates = getWeekDates();
    return {
      labels: dates.map((_,i)=>DAYS_FA[i]),
      data:   dates.map(d => weekData[d]??( d===todayKey ? pct : null )),
      title:  "۷ روز گذشته",
      note:   "درصد بر اساس مجموع ضریب‌های انجام‌شده",
      type:   "line",
    };
  }
  if (chartMode === "monthly") {
    const dates = getMonthDates();
    return {
      labels: dates.map(d=>{ const o=new Date(d); return `${o.getDate()}/${o.getMonth()+1}`; }),
      data:   dates.map(d => weekData[d]??(d===todayKey?pct:null)),
      title:  "۳۰ روز گذشته",
      note:   "روزهایی که داده ندارن خالی نشون داده می‌شن",
      type:   "line",
    };
  }
  if (chartMode === "yearly") {
    const months = getYearMonths();
    return {
      labels: months.map(ym=>MONTHS_FA[parseInt(ym.split("-")[1])-1]),
      data: months.map(ym=>{
        const keys = Object.keys(weekData).filter(d=>d.startsWith(ym));
        const vals = keys.map(k=>weekData[k]).filter(v=>v!=null);
        return vals.length>0 ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
      }),
      title:  "۱۲ ماه گذشته — میانگین ماهانه",
      note:   "خط نقطه‌چین = هدف ۷۰٪",
      type:   "bar",
    };
  }
  // alltime
  const allKeys = Object.keys(weekData).sort();
  const monthMap = {};
  allKeys.forEach(d=>{ const [y,m]=d.split("-"); const k=`${y}-${m}`; (monthMap[k]=monthMap[k]||[]).push(weekData[d]); });
  const tm = todayKey.substring(0,7);
  monthMap[tm] = monthMap[tm]||[];
  if (!monthMap[tm].includes(pct)) monthMap[tm].push(pct);
  const entries = Object.entries(monthMap).sort(([a],[b])=>a.localeCompare(b));
  if (entries.length===0) { const mi=getTehranNow().getMonth(); entries.push([`-`,pct]); }
  return {
    labels: entries.map(([ym])=>{ const [y,m]=ym.split("-"); return `${MONTHS_FA[parseInt(m)-1]} '${y?y.slice(2):""}`; }),
    data:   entries.map(([,v])=>Array.isArray(v)?Math.round(v.reduce((a,b)=>a+b,0)/v.length):v),
    title:  "کل تاریخچه — میانگین ماهانه",
    note:   "میانگین پیشرفت روزانه در هر ماه",
    type:   "line",
  };
}

function renderChart() {
  const { labels, data, title, note, type } = buildChartData();
  document.getElementById("chartTitle").textContent = title;
  document.getElementById("chartNote").textContent  = note;

  const ctx = document.getElementById("mainChart").getContext("2d");
  if (chartInst) { chartInst.destroy(); chartInst = null; }

  const grad = ctx.createLinearGradient(0,0,0,180);
  grad.addColorStop(0,"rgba(167,139,250,0.35)");
  grad.addColorStop(1,"rgba(96,165,250,0.03)");

  const baseDataset = {
    data,
    borderColor: "#a78bfa",
    backgroundColor: type==="bar" ? "rgba(167,139,250,0.7)" : grad,
    borderWidth: 2.5,
    tension: 0.4,
    pointBackgroundColor: "#60a5fa",
    pointBorderColor: "#0f0c29",
    pointRadius: 4,
    pointHoverRadius: 6,
    fill: type==="line",
    spanGaps: false,
    borderRadius: type==="bar" ? 6 : 0,
  };

  const annotations = chartMode==="yearly"||chartMode==="alltime" ? {
    line70: {
      type:"line", yMin:70, yMax:70,
      borderColor:"rgba(167,139,250,0.35)", borderWidth:1, borderDash:[4,4],
    }
  } : {};

  chartInst = new Chart(ctx, {
    type,
    data: { labels, datasets: [baseDataset] },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          rtl: true, textDirection: "rtl",
          backgroundColor: "#1e1b4b",
          titleColor: "#a78bfa", bodyColor: "#fff",
          borderColor: "#a78bfa", borderWidth: 1,
          callbacks: { label: ctx => ctx.parsed.y + "٪" }
        },
        annotation: { annotations },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#9ca3af", font:{size:12} },
          border: { display: false },
        },
        y: {
          min: 0, max: 100,
          grid: { color: "rgba(255,255,255,0.05)", drawBorder:false },
          ticks: { color:"rgba(255,255,255,0.25)", font:{size:11}, callback:v=>v+"%" },
          border: { display: false },
        }
      }
    }
  });
}

// ─── Ticker ───────────────────────────────────────────────────────────────
function tick() {
  const now = getTehranNow();
  document.getElementById("clockStr").textContent = getTimeStr(now);
  document.getElementById("dateStr").textContent  = now.toLocaleDateString("fa-IR",{weekday:"long",month:"long",day:"numeric"});

  const ms = getMsUntilMidnight();
  const s  = Math.floor(ms/1000);
  const h  = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60;
  const cd = document.getElementById("countdown");
  cd.textContent = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
  cd.classList.toggle("urgent", h < 1);

  const currentKey = getTehranDateKey(now);
  if (currentKey !== prevDay) {
    saveProgress(true);
    checked = {};
    store.set("pl-checked-"+currentKey, {});
    todayKey = currentKey; prevDay = currentKey;
    renderTasks(); updateProgress();
  }
}

// Pre-midnight save
function schedulePreSave() {
  const ms = getMsUntilMidnight() - 10000;
  if (ms > 0) setTimeout(() => { saveProgress(true); schedulePreSave(); }, ms);
}

// ─── Tab switching ────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-"+btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "chart") renderChart();
  });
});

document.querySelectorAll(".chart-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chart-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    chartMode = btn.dataset.chart;
    renderChart();
  });
});

// ─── Init ─────────────────────────────────────────────────────────────────
document.getElementById("addTaskBtn").addEventListener("click", addTask);
document.getElementById("newTaskInput").addEventListener("keydown", e => e.key==="Enter" && addTask());
document.getElementById("addReminderBtn").addEventListener("click", addReminder);

initNewStarPicker();
renderTasks();
updateProgress();
renderReminders();
tick();
setInterval(tick, 1000);
schedulePreSave();
