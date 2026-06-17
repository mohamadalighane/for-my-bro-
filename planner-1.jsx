import { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, LineChart, Line, ReferenceLine
} from "recharts";

const DAYS_FA = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const MONTHS_FA = ["فرو", "ارد", "خرد", "تیر", "مرد", "شهر", "مهر", "آبا", "آذر", "دی", "بهم", "اسف"];

// ─── Tehran time utilities ─────────────────────────────────────────────────
function getTehranNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tehran" }));
}

function getTehranDateKey(date) {
  const d = date || getTehranNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMsUntilTehranMidnight() {
  const now = getTehranNow();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow - now;
}

function getTehranTimeStr(date) {
  return (date || getTehranNow()).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const defaultTasks = [
  { id: "1", name: "مطالعه", stars: 3 },
  { id: "2", name: "ورزش", stars: 5 },
  { id: "3", name: "کار پروژه", stars: 4 },
  { id: "4", name: "مدیتیشن", stars: 2 },
  { id: "5", name: "مطالعه کتاب", stars: 3 },
];

function getWeekDates() {
  const today = getTehranNow();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 6 + i);
    return getTehranDateKey(d);
  });
}

function getMonthDates() {
  const today = getTehranNow();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 29 + i);
    return getTehranDateKey(d);
  });
}

function getYearMonths() {
  const today = getTehranNow();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today);
    d.setMonth(today.getMonth() - 11 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

// ─── StarSVG ───────────────────────────────────────────────────────────────
function StarSVG({ fill, size }) {
  const uid = Math.random().toString(36).slice(2, 8);
  const points = "10,2 12.4,7.5 18.5,8 14,12.5 15.5,18.5 10,15.5 4.5,18.5 6,12.5 1.5,8 7.6,7.5";
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <clipPath id={"lc" + uid}><rect x="0" y="0" width="10" height="20" /></clipPath>
        <clipPath id={"rc" + uid}><rect x="10" y="0" width="10" height="20" /></clipPath>
      </defs>
      <polygon points={points} fill="rgba(255,255,255,0.18)" />
      {fill >= 0.5 && <polygon points={points} fill="#fbbf24" clipPath={"url(#lc" + uid + ")"} />}
      {fill >= 1 && <polygon points={points} fill="#fbbf24" clipPath={"url(#rc" + uid + ")"} />}
    </svg>
  );
}

function HalfStarPicker({ value, onChange, size }) {
  const [hovered, setHovered] = useState(null);
  const display = hovered !== null ? hovered : value;
  return (
    <div style={{ display: "flex", gap: 2, direction: "ltr", userSelect: "none" }} onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map(s => {
        const fill = display >= s ? 1 : display >= s - 0.5 ? 0.5 : 0;
        return (
          <div key={s} style={{ position: "relative", width: size, height: size, cursor: "pointer" }}>
            <StarSVG fill={fill} size={size} />
            <div style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%" }}
              onMouseEnter={() => setHovered(s - 0.5)}
              onClick={e => { e.stopPropagation(); onChange(s - 0.5); }} />
            <div style={{ position: "absolute", right: 0, top: 0, width: "50%", height: "100%" }}
              onMouseEnter={() => setHovered(s)}
              onClick={e => { e.stopPropagation(); onChange(s); }} />
          </div>
        );
      })}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, unit = "٪ پیشرفت" }) => {
  if (active && payload && payload.length && payload[0].value !== null && payload[0].value !== undefined) {
    return (
      <div style={{ background: "#1e1b4b", border: "1px solid #a78bfa", borderRadius: 10, padding: "8px 14px", color: "#fff", direction: "rtl", fontSize: 13 }}>
        <div style={{ color: "#a78bfa", marginBottom: 4 }}>{label}</div>
        <div>{payload[0].value}{unit}</div>
      </div>
    );
  }
  return null;
};

// ─── Chart Section ─────────────────────────────────────────────────────────
const TABS = [
  { key: "weekly", label: "هفتگی" },
  { key: "monthly", label: "ماهانه" },
  { key: "yearly", label: "سالانه" },
  { key: "alltime", label: "کل" },
];

function ChartSection({ weekData, todayKey, donePct }) {
  const [activeTab, setActiveTab] = useState("weekly");

  const weeks = getWeekDates();
  const weeklyData = weeks.map((d, i) => ({
    day: DAYS_FA[i],
    pct: weekData[d] !== undefined ? weekData[d] : (d === todayKey ? donePct : null),
    isToday: d === todayKey,
  }));

  const monthDates = getMonthDates();
  const monthlyData = monthDates.map((d, i) => {
    const dateObj = new Date(d);
    const label = i % 5 === 0 ? `${dateObj.getDate()}/${dateObj.getMonth() + 1}` : "";
    return {
      label,
      fullLabel: `${dateObj.getDate()}/${dateObj.getMonth() + 1}`,
      pct: weekData[d] !== undefined ? weekData[d] : (d === todayKey ? donePct : null),
      isToday: d === todayKey,
    };
  });

  const yearMonths = getYearMonths();
  const yearlyData = yearMonths.map((ym) => {
    const keys = Object.keys(weekData).filter(d => d.startsWith(ym));
    const vals = keys.map(k => weekData[k]).filter(v => v !== null && v !== undefined);
    const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    const monthIdx = parseInt(ym.split("-")[1]) - 1;
    return { month: MONTHS_FA[monthIdx], pct: avg };
  });

  const allKeys = Object.keys(weekData).sort();
  let alltimeData = [];
  if (allKeys.length > 0) {
    const monthMap = {};
    allKeys.forEach(d => {
      const [y, m] = d.split("-");
      const key = `${y}-${m}`;
      if (!monthMap[key]) monthMap[key] = [];
      monthMap[key].push(weekData[d]);
    });
    const todayMonth = todayKey.substring(0, 7);
    if (!monthMap[todayMonth]) monthMap[todayMonth] = [];
    if (!monthMap[todayMonth].includes(donePct)) monthMap[todayMonth].push(donePct);
    alltimeData = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, vals]) => {
        const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        const monthIdx = parseInt(ym.split("-")[1]) - 1;
        const year = ym.split("-")[0].slice(2);
        return { label: `${MONTHS_FA[monthIdx]} '${year}`, pct: avg };
      });
  }
  if (alltimeData.length === 0) {
    const mi = getTehranNow().getMonth();
    alltimeData = [{ label: `${MONTHS_FA[mi]} '${String(getTehranNow().getFullYear()).slice(2)}`, pct: donePct }];
  }

  const gradDefs = (
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} />
        <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.03} />
      </linearGradient>
      <linearGradient id="strokeGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#a78bfa" />
        <stop offset="100%" stopColor="#60a5fa" />
      </linearGradient>
      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.9} />
        <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.5} />
      </linearGradient>
    </defs>
  );

  return (
    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 20, padding: "16px 8px 8px", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, paddingRight: 8, paddingLeft: 8 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            flex: 1, background: activeTab === t.key ? "linear-gradient(135deg, #a78bfa, #60a5fa)" : "rgba(255,255,255,0.06)",
            border: "none", borderRadius: 10, padding: "7px 0", color: activeTab === t.key ? "#fff" : "rgba(255,255,255,0.45)",
            fontSize: 13, fontWeight: activeTab === t.key ? 700 : 400, cursor: "pointer", transition: "all 0.2s",
          }}>{t.label}</button>
        ))}
      </div>

      {activeTab === "weekly" && (
        <>
          <div style={{ fontSize: 13, color: "#a78bfa", fontWeight: 700, paddingRight: 8, marginBottom: 8 }}>۷ روز گذشته</div>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={weeklyData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              {gradDefs}
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#9ca3af", fontSize: 13 }} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} tickFormatter={v => v + "%"} width={38} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="pct" stroke="url(#strokeGrad)" strokeWidth={2.5} fill="url(#areaGrad)" connectNulls={false}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (payload.pct === null || payload.pct === undefined) return <g key={"e" + cx} />;
                  return payload.isToday
                    ? <g key={"t" + cx}><circle cx={cx} cy={cy} r={7} fill="#a78bfa" stroke="#fff" strokeWidth={2} /><circle cx={cx} cy={cy} r={3} fill="#fff" /></g>
                    : <circle key={"d" + cx} cx={cx} cy={cy} r={4} fill="#60a5fa" stroke="#0f0c29" strokeWidth={1.5} />;
                }}
                activeDot={{ r: 6, fill: "#a78bfa", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2, paddingBottom: 6 }}>درصد بر اساس مجموع ضریب‌های انجام‌شده</div>
        </>
      )}

      {activeTab === "monthly" && (
        <>
          <div style={{ fontSize: 13, color: "#a78bfa", fontWeight: 700, paddingRight: 8, marginBottom: 8 }}>۳۰ روز گذشته</div>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={monthlyData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              {gradDefs}
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#9ca3af", fontSize: 11 }} interval={0} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} tickFormatter={v => v + "%"} width={38} />
              <Tooltip content={<CustomTooltip unit="٪" />} />
              <Area type="monotone" dataKey="pct" stroke="url(#strokeGrad)" strokeWidth={2} fill="url(#areaGrad)" connectNulls={false}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (payload.pct === null || payload.pct === undefined) return <g key={"em" + cx} />;
                  return payload.isToday
                    ? <g key={"tm" + cx}><circle cx={cx} cy={cy} r={6} fill="#a78bfa" stroke="#fff" strokeWidth={2} /><circle cx={cx} cy={cy} r={2.5} fill="#fff" /></g>
                    : <circle key={"dm" + cx} cx={cx} cy={cy} r={2.5} fill="#60a5fa" stroke="#0f0c29" strokeWidth={1} />;
                }}
                activeDot={{ r: 5, fill: "#a78bfa", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2, paddingBottom: 6 }}>روزهایی که داده ندارن خالی نشون داده می‌شن</div>
        </>
      )}

      {activeTab === "yearly" && (
        <>
          <div style={{ fontSize: 13, color: "#a78bfa", fontWeight: 700, paddingRight: 8, marginBottom: 8 }}>۱۲ ماه گذشته — میانگین ماهانه</div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={yearlyData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }} barCategoryGap="30%">
              {gradDefs}
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} tickFormatter={v => v + "%"} width={38} />
              <Tooltip content={<CustomTooltip unit="٪ میانگین" />} />
              <ReferenceLine y={70} stroke="rgba(167,139,250,0.25)" strokeDasharray="4 4" />
              <Bar dataKey="pct" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2, paddingBottom: 6 }}>خط نقطه‌چین = هدف ۷۰٪ — ماه‌هایی که داده ندارن خالی‌اند</div>
        </>
      )}

      {activeTab === "alltime" && (
        <>
          <div style={{ fontSize: 13, color: "#a78bfa", fontWeight: 700, paddingRight: 8, marginBottom: 8 }}>کل تاریخچه — میانگین ماهانه</div>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={alltimeData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              {gradDefs}
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} tickFormatter={v => v + "%"} width={38} />
              <Tooltip content={<CustomTooltip unit="٪ میانگین" />} />
              <ReferenceLine y={70} stroke="rgba(167,139,250,0.25)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="pct" stroke="url(#strokeGrad)" strokeWidth={2.5} connectNulls
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (payload.pct === null || payload.pct === undefined) return <g key={"ea" + cx} />;
                  return <circle key={"da" + cx} cx={cx} cy={cy} r={5} fill="#a78bfa" stroke="#fff" strokeWidth={1.5} />;
                }}
                activeDot={{ r: 6, fill: "#60a5fa", stroke: "#fff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2, paddingBottom: 6 }}>میانگین پیشرفت روزانه در هر ماه</div>
        </>
      )}
    </div>
  );
}

// ─── Scheduler Panel ───────────────────────────────────────────────────────
const PRESET_REMINDERS = [
  { id: "r1", label: "شروع روز", time: "07:00", emoji: "🌅", active: true },
  { id: "r2", label: "چک میانه روز", time: "13:00", emoji: "☀️", active: false },
  { id: "r3", label: "مرور عصر", time: "18:00", emoji: "🌆", active: false },
  { id: "r4", label: "ذخیره شب", time: "23:59", emoji: "🌙", active: true, readonly: true, note: "خودکار — قبل از ۱۲ شب تهران" },
];

function SchedulerPanel({ lastSaveInfo, nextSaveIn }) {
  const [reminders, setReminders] = useState(PRESET_REMINDERS);
  const [customTime, setCustomTime] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    async function load() {
      try { const r = await window.storage.get("planner-reminders"); if (r) setReminders(JSON.parse(r.value)); } catch {}
    }
    load();
  }, []);

  const save = (newR) => {
    setReminders(newR);
    window.storage.set("planner-reminders", JSON.stringify(newR)).catch(() => {});
  };

  const toggle = (id) => {
    const r = reminders.find(r => r.id === id);
    if (r?.readonly) return;
    save(reminders.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  const addCustom = () => {
    if (!customTime) return;
    const label = customLabel.trim() || "یادآور";
    const newR = [...reminders, { id: Date.now().toString(), label, time: customTime, emoji: "⏰", active: true }];
    save(newR);
    setCustomTime(""); setCustomLabel("");
    setFlash("added");
    setTimeout(() => setFlash(null), 1500);
  };

  const removeReminder = (id) => {
    const r = reminders.find(r => r.id === id);
    if (r?.readonly) return;
    save(reminders.filter(r => r.id !== id));
  };

  const activeCount = reminders.filter(r => r.active).length;

  return (
    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 16, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 14, color: "#a78bfa", fontWeight: 700 }}>📅 برنامه‌ریزی یادآورها</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", background: "rgba(167,139,250,0.1)", borderRadius: 8, padding: "3px 10px" }}>
          {activeCount} فعال
        </div>
      </div>

      {/* Midnight save countdown */}
      <div style={{ background: "rgba(167,139,250,0.1)", borderRadius: 14, padding: "10px 14px", marginBottom: 14, border: "1px solid rgba(167,139,250,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, color: "#c4b5fd", fontWeight: 700 }}>🌙 ذخیره خودکار ۱۲ شب تهران</div>
            {lastSaveInfo && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>
                آخرین ذخیره: {lastSaveInfo}
              </div>
            )}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>تا ذخیره بعدی</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: nextSaveIn.hours < 1 ? "#f87171" : "#a78bfa", direction: "ltr" }}>
              {String(nextSaveIn.hours).padStart(2, "0")}:{String(nextSaveIn.minutes).padStart(2, "0")}:{String(nextSaveIn.seconds).padStart(2, "0")}
            </div>
          </div>
        </div>
      </div>

      {/* Reminder list */}
      <div style={{ marginBottom: 14 }}>
        {reminders.map(r => (
          <div key={r.id} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 0",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            opacity: r.active ? 1 : 0.45,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{r.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: "#fff" }}>{r.label}</div>
              {r.note && <div style={{ fontSize: 11, color: "#a78bfa", marginTop: 1 }}>{r.note}</div>}
            </div>
            <div style={{ fontSize: 13, color: "#a78bfa", direction: "ltr", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{r.time}</div>
            <div
              onClick={() => toggle(r.id)}
              style={{
                width: 36, height: 20, borderRadius: 10, flexShrink: 0, cursor: r.readonly ? "default" : "pointer",
                background: r.active ? "linear-gradient(135deg, #a78bfa, #60a5fa)" : "rgba(255,255,255,0.1)",
                position: "relative", transition: "background 0.2s",
              }}>
              <div style={{
                width: 14, height: 14, borderRadius: "50%", background: "#fff",
                position: "absolute", top: 3, left: r.active ? 19 : 3, transition: "left 0.2s",
              }} />
            </div>
            {!r.readonly && (
              <button onClick={() => removeReminder(r.id)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 18, padding: "0 2px", lineHeight: 1 }}
                onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}>×</button>
            )}
          </div>
        ))}
      </div>

      {/* Add custom reminder */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "10px 12px" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>افزودن یادآور سفارشی</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={customLabel} onChange={e => setCustomLabel(e.target.value)}
            placeholder="عنوان یادآور..."
            style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", color: "#fff", fontSize: 13, direction: "rtl", outline: "none" }}
          />
          <input
            type="time" value={customTime} onChange={e => setCustomTime(e.target.value)}
            style={{ width: 96, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 13, direction: "ltr", outline: "none", colorScheme: "dark" }}
          />
        </div>
        <button onClick={addCustom} style={{
          width: "100%", background: flash === "added" ? "rgba(167,139,250,0.3)" : "rgba(167,139,250,0.15)",
          border: "1px solid rgba(167,139,250,0.3)", borderRadius: 10, padding: "8px 0",
          color: "#c4b5fd", fontSize: 13, cursor: "pointer", transition: "all 0.2s",
        }}>
          {flash === "added" ? "✓ اضافه شد" : "+ افزودن یادآور"}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export default function Planner() {
  const [tasks, setTasks] = useState(defaultTasks);
  const [newTask, setNewTask] = useState("");
  const [newStars, setNewStars] = useState(3);
  const [checked, setChecked] = useState({});
  const [weekData, setWeekData] = useState({});
  const [editingTask, setEditingTask] = useState(null);
  const [editText, setEditText] = useState("");
  const [lastSaveInfo, setLastSaveInfo] = useState(null);
  const [activeTab, setActiveTab] = useState("planner"); // "planner" | "scheduler"
  const [nextSaveIn, setNextSaveIn] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [tehranTime, setTehranTime] = useState(getTehranTimeStr());
  const [saveFlash, setSaveFlash] = useState(false);

  const todayKey = getTehranDateKey();
  const prevDayRef = useRef(todayKey);
  const checkedRef = useRef(checked);
  const donePctRef = useRef(0);

  useEffect(() => { checkedRef.current = checked; }, [checked]);

  // ── Load from storage ──
  useEffect(() => {
    async function load() {
      try { const r = await window.storage.get("planner-tasks2"); if (r) setTasks(JSON.parse(r.value)); } catch {}
      try { const r = await window.storage.get("planner-checked-" + todayKey); if (r) setChecked(JSON.parse(r.value)); } catch {}
      try { const r = await window.storage.get("planner-weekdata2"); if (r) setWeekData(JSON.parse(r.value)); } catch {}
      try { const r = await window.storage.get("planner-lastsave"); if (r) setLastSaveInfo(r.value); } catch {}
    }
    load();
  }, []);

  useEffect(() => { window.storage.set("planner-tasks2", JSON.stringify(tasks)).catch(() => {}); }, [tasks]);

  const totalWeight = tasks.reduce((s, t) => s + t.stars, 0);
  const doneWeight = tasks.filter(t => checked[t.id]).reduce((s, t) => s + t.stars, 0);
  const donePct = totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0;
  donePctRef.current = donePct;

  // ── Save today's progress ──
  const saveProgress = useCallback((dateKey, pct, isAutoSave = false) => {
    window.storage.set("planner-checked-" + dateKey, JSON.stringify(checkedRef.current)).catch(() => {});
    setWeekData(prev => {
      const updated = { ...prev, [dateKey]: pct };
      window.storage.set("planner-weekdata2", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    if (isAutoSave) {
      const info = `${dateKey} — ${getTehranTimeStr()}`;
      setLastSaveInfo(info);
      window.storage.set("planner-lastsave", info).catch(() => {});
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 3000);
    }
  }, []);

  // ── Auto-save on checked/pct change ──
  useEffect(() => {
    saveProgress(todayKey, donePct, false);
  }, [checked, donePct]);

  // ─── Ticker: Tehran clock + countdown + midnight detection ────────────────
  useEffect(() => {
    const tick = () => {
      const now = getTehranNow();
      setTehranTime(getTehranTimeStr(now));

      // Countdown to midnight
      const ms = getMsUntilTehranMidnight();
      const totalSec = Math.floor(ms / 1000);
      setNextSaveIn({
        hours: Math.floor(totalSec / 3600),
        minutes: Math.floor((totalSec % 3600) / 60),
        seconds: totalSec % 60,
      });

      // Day change detection — fires just after midnight Tehran
      const currentKey = getTehranDateKey(now);
      if (currentKey !== prevDayRef.current) {
        // Save previous day's final state
        saveProgress(prevDayRef.current, donePctRef.current, true);
        // Reset for new day
        setChecked({});
        prevDayRef.current = currentKey;
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [saveProgress]);

  // ── Also fire save 10 sec before midnight ──
  useEffect(() => {
    const schedulePreSave = () => {
      const ms = getMsUntilTehranMidnight() - 10000; // 10s before midnight
      if (ms > 0) {
        const t = setTimeout(() => {
          saveProgress(getTehranDateKey(), donePctRef.current, true);
          schedulePreSave(); // reschedule for next day
        }, ms);
        return t;
      }
    };
    const t = schedulePreSave();
    return () => clearTimeout(t);
  }, [saveProgress]);

  const toggle = id => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const addTask = () => {
    const name = newTask.trim(); if (!name) return;
    setTasks(prev => [...prev, { id: Date.now().toString(), name, stars: newStars }]);
    setNewTask(""); setNewStars(3);
  };
  const removeTask = id => { setTasks(prev => prev.filter(t => t.id !== id)); setChecked(prev => { const c = { ...prev }; delete c[id]; return c; }); };
  const saveEdit = id => { const name = editText.trim(); if (name) setTasks(prev => prev.map(t => t.id === id ? { ...t, name } : t)); setEditingTask(null); };
  const doneCount = tasks.filter(t => checked[t.id]).length;

  const today = getTehranNow();

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)", fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl", padding: "24px 16px", color: "#fff" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.07)", borderRadius: 20, padding: "6px 20px", fontSize: 13, color: "#a78bfa", marginBottom: 8 }}>
          <span>{today.toLocaleDateString("fa-IR", { weekday: "long", month: "long", day: "numeric" })}</span>
          <span style={{ direction: "ltr", color: "rgba(255,255,255,0.5)", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{tehranTime}</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, background: "linear-gradient(90deg, #a78bfa, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>برنامه‌ریزی روزانه</h1>

        {/* Auto-save flash */}
        {saveFlash && (
          <div style={{ marginTop: 8, display: "inline-block", background: "rgba(167,139,250,0.2)", border: "1px solid rgba(167,139,250,0.4)", borderRadius: 10, padding: "4px 16px", fontSize: 12, color: "#c4b5fd", animation: "fadeIn 0.3s ease" }}>
            ✓ اطلاعات روز ذخیره شد
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 4 }}>
        {[{ key: "planner", label: "📋 برنامه‌ریز" }, { key: "scheduler", label: "⏰ زمان‌بندی" }, { key: "chart", label: "📊 نمودار" }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            flex: 1, background: activeTab === t.key ? "linear-gradient(135deg, #a78bfa, #60a5fa)" : "transparent",
            border: "none", borderRadius: 10, padding: "9px 0", color: activeTab === t.key ? "#fff" : "rgba(255,255,255,0.45)",
            fontSize: 13, fontWeight: activeTab === t.key ? 700 : 400, cursor: "pointer", transition: "all 0.2s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── PLANNER TAB ── */}
      {activeTab === "planner" && (
        <>
          {/* Progress ring */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 24, gap: 20 }}>
            <div style={{ position: "relative", width: 100, height: 100 }}>
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(167,139,250,0.15)" strokeWidth="10" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="url(#pg)" strokeWidth="10"
                  strokeDasharray={2 * Math.PI * 42} strokeDashoffset={2 * Math.PI * 42 * (1 - donePct / 100)}
                  strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
                <defs><linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#60a5fa" /></linearGradient></defs>
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 22, fontWeight: 800 }}>{donePct}%</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 15, color: "#a78bfa", fontWeight: 700 }}>امروز</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{doneCount} از {tasks.length} کار</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{doneWeight} از {totalWeight} ستاره</div>
              <div style={{ marginTop: 8, background: "rgba(167,139,250,0.15)", borderRadius: 8, padding: "4px 12px", fontSize: 12, color: "#c4b5fd" }}>
                {donePct === 100 ? "🎉 آفرین! همه کارها انجام شد" : donePct >= 70 ? "💪 عالی پیش می‌ری!" : donePct >= 40 ? "⚡ ادامه بده!" : "🌅 روزت رو شروع کن!"}
              </div>
            </div>
          </div>

          {/* Task list */}
          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 16, marginBottom: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 14, color: "#a78bfa", marginBottom: 14, fontWeight: 700 }}>کارهای امروز</div>
            {tasks.map(task => (
              <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div onClick={() => toggle(task.id)} style={{
                  width: 24, height: 24, borderRadius: 8, flexShrink: 0, cursor: "pointer",
                  border: checked[task.id] ? "none" : "2px solid rgba(167,139,250,0.5)",
                  background: checked[task.id] ? "linear-gradient(135deg, #a78bfa, #60a5fa)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                }}>
                  {checked[task.id] && <span style={{ color: "#fff", fontSize: 14 }}>✓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingTask === task.id ? (
                    <input value={editText} onChange={e => setEditText(e.target.value)}
                      onBlur={() => saveEdit(task.id)} onKeyDown={e => e.key === "Enter" && saveEdit(task.id)} autoFocus
                      style={{ width: "100%", background: "rgba(255,255,255,0.1)", border: "1px solid #a78bfa", borderRadius: 8, padding: "4px 8px", color: "#fff", fontSize: 14, direction: "rtl", outline: "none", boxSizing: "border-box" }} />
                  ) : (
                    <span onDoubleClick={() => { setEditingTask(task.id); setEditText(task.name); }}
                      style={{ fontSize: 15, color: checked[task.id] ? "rgba(255,255,255,0.35)" : "#fff", textDecoration: checked[task.id] ? "line-through" : "none", transition: "all 0.2s" }}>
                      {task.name}
                    </span>
                  )}
                </div>
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <HalfStarPicker value={task.stars} size={20}
                    onChange={s => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, stars: s } : t))} />
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>ضریب: {task.stars}</span>
                </div>
                <button onClick={() => removeTask(task.id)}
                  onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.25)"}
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 20, padding: "0 4px", lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>
            ))}

            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input value={newTask} onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTask()} placeholder="افزودن کار جدید..."
                  style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "10px 14px", color: "#fff", fontSize: 14, direction: "rtl", outline: "none" }} />
                <button onClick={addTask}
                  style={{ background: "linear-gradient(135deg, #a78bfa, #60a5fa)", border: "none", borderRadius: 12, padding: "10px 18px", color: "#fff", cursor: "pointer", fontSize: 20, fontWeight: 700 }}>+</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>ضریب کار جدید:</span>
                <HalfStarPicker value={newStars} onChange={setNewStars} size={22} />
                <span style={{ fontSize: 12, color: "#a78bfa" }}>{newStars} ستاره</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── SCHEDULER TAB ── */}
      {activeTab === "scheduler" && (
        <SchedulerPanel lastSaveInfo={lastSaveInfo} nextSaveIn={nextSaveIn} />
      )}

      {/* ── CHART TAB ── */}
      {activeTab === "chart" && (
        <ChartSection weekData={weekData} todayKey={todayKey} donePct={donePct} />
      )}
    </div>
  );
}
