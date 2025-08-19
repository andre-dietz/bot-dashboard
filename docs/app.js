// ---- Status-Logik ----
const PUBLISH_EVERY_MS = 5 * 60 * 1000;       // Bot publisht alle 5 Min
const FRESH_MAX_MS     = PUBLISH_EVERY_MS * 2.2;  // Toleranz

const $  = (id) => document.getElementById(id);
const ok = (v)  => (v === true || v === "true") ? "ja" : "nein";

function computeStatus(tsISO, onlineFlag){
  const age = Date.now() - new Date(tsISO).getTime();
  if (!onlineFlag)        return { key: "offline", age };
  if (age > FRESH_MAX_MS) return { key: "stale",   age };
  return { key: "online", age };
}

function setStatus(tsISO, onlineFlag){
  const st = computeStatus(tsISO, !!onlineFlag);
  document.querySelectorAll('.dot').forEach(el => {
    el.classList.remove('online','stale','offline');
    el.classList.add(st.key);
  });
  const tsStr = new Date(tsISO).toLocaleString();
  const txt   = $('status-text');
  if (txt) txt.textContent = st.key;
  const uh = $('updated-header');
  const uf = $('updated-footer');
  if (uh) uh.textContent = tsStr;
  if (uf) uf.textContent = tsStr;
}

// ---- Chart ----
let chart;
function initChart() {
  const ctx = document.getElementById("equityChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: { datasets: [{ label: "Equity", data: [] }] },
    options: {
      parsing: false,
      responsive: true,
      interaction: { intersect: false, mode: "index" },
      plugins: { legend: { display: false } },
      scales: {
        x: { type: "time", time: { unit: "minute" } },
        y: { ticks: { callback: (v) => v.toLocaleString() } }
      }
    }
  });
}

// ---- Fetch helpers ----
async function fetchJSON(u){
  const r = await fetch(`${u}?_=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
}
async function fetchText(u){
  const r = await fetch(`${u}?_=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(r.statusText);
  return r.text();
}

// ---- State laden ----
async function loadState(){
  const s = await fetchJSON("data/state.json");

  $("sym").textContent     = s.symbol ?? "–";
  $("price").textContent   = (s.price ?? 0).toFixed(3);
  $("conf").textContent    = (s.confidence ?? 0).toFixed(3);
  $("rf").textContent      = String(s.rf_signal ?? "–");
  $("trades").textContent  = String(s.active_trades ?? 0);
  $("bal").textContent     = (s.balance_clean ?? 0).toLocaleString();

  const sent = s.sentiment || {};
  $("sent-p").textContent   = `P: ${(sent.positive ?? 0).toFixed(2)}`;
  $("sent-n").textContent   = `N: ${(sent.neutral  ?? 0).toFixed(2)}`;
  $("sent-neg").textContent = `Neg: ${(sent.negative ?? 0).toFixed(2)}`;

  $("reg-scale").textContent = (s.regime?.scale ?? 1).toFixed(2);
  $("reg-block").textContent = ok(s.regime?.block ?? false);
  const ul = $("reg-reasons"); ul.innerHTML = "";
  (s.regime?.reasons ?? []).forEach(r => {
    const li = document.createElement("li");
    li.textContent = r; ul.appendChild(li);
  });

  setStatus(s.ts, s.online);
}

// ---- Equity laden ----
async function loadEquity(){
  const csv = await fetchText("data/equity.csv");
  const lines = csv.trim().split("\n");
  const rows = lines.slice(1).map(l => {
    const [ts, eq] = l.split(",");
    return { x: new Date(ts), y: parseFloat(eq) };
  });
  if (rows.length === 1) {
    rows.push({ x: new Date(rows[0].x.getTime() + 60_000), y: rows[0].y });
  }
  chart.data.datasets[0].data = rows;
  chart.update();
}

// ---- Ticker ----
async function tick(){
  try {
    await Promise.all([loadState(), loadEquity()]);
  } catch(e) {
    console.error(e);
  }
}

window.addEventListener("load", async ()=>{
  initChart();
  await tick();
  setInterval(tick, 60_000); // jede Minute
});
