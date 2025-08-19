const PUBLISH_EVERY_MS = 5 * 60 * 1000;       // dein Bot publish-Intervall
const FRESH_MAX_MS = PUBLISH_EVERY_MS * 2.2;  // Toleranz

function computeStatus(tsISO, onlineFlag){
  const age = Date.now() - new Date(tsISO).getTime();
  if (!onlineFlag) return {key:'offline', age};
  if (age > FRESH_MAX_MS) return {key:'stale', age}; // Daten veraltet
  return {key:'online', age};
}
const $ = (id) => document.getElementById(id);
const ok = (v) => (v===true || v==="true" ? "ja" : "nein");

let chart;
function initChart() {
  const ctx = document.getElementById("equityChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: { datasets: [{ label: "Equity", data: [] }] },
    options: {
      parsing:false,
      responsive:true,
      interaction:{ intersect:false, mode:"index" },
      plugins:{ legend:{display:false} },
      scales:{
        x:{ type:"time", time:{ unit:"minute" } },
        y:{ ticks:{ callback:(v)=> v.toLocaleString() } }
      }
    }
  });
}

async function fetchJSON(path){
  const r = await fetch(path + "?ts=" + Date.now());
  if(!r.ok) throw new Error("fetch failed " + path);
  return r.json();
}
async function fetchCSV(path){
  const r = await fetch(path + "?ts=" + Date.now());
  if(!r.ok) throw new Error("fetch failed " + path);
  return r.text();
}

function setOnline(tsIso){
  const ts = new Date(tsIso);
  const ageSec = (Date.now() - ts.getTime())/1000;
  const online = ageSec < 150; // < 2.5min als "online"
  const dot = document.querySelector(".dot");
  dot.classList.toggle("online", online);
  $("status-text").textContent = online ? "online" : "offline";
  $("updated").textContent = ts.toLocaleString();
}

async function loadState(){
  try{
    const s = await fetchJSON(`data/state.json?ts=${Date.now()}`);
    $("sym").textContent   = s.symbol ?? "–";
    $("price").textContent = (s.price ?? 0).toFixed(3);
    $("conf").textContent  = (s.confidence ?? 0).toFixed(3);
    $("rf").textContent    = String(s.rf_signal ?? "–");
    $("trades").textContent= String(s.active_trades ?? 0);
    $("bal").textContent   = (s.balance_clean ?? 0).toLocaleString();

    const dot = document.querySelector('#status-dot'); // <span id="status-dot"></span>
    dot.className = `dot ${st.key}`;
    dot.textContent = ` ${st.key}`; // optional: text
    
    const sent = s.sentiment || {};
    $("sent-p").textContent   = (sent.positive ?? 0).toFixed(2);
    $("sent-n").textContent   = (sent.neutral ?? 0).toFixed(2);
    $("sent-neg").textContent = (sent.negative ?? 0).toFixed(2);

    $("reg-scale").textContent = (s.regime?.scale ?? 1).toFixed(2);
    $("reg-block").textContent = ok(s.regime?.block ?? false);
    const ul = $("reg-reasons");
    ul.innerHTML = "";
    (s.regime?.reasons ?? []).forEach(r=>{
      const li = document.createElement("li"); li.textContent = r; ul.appendChild(li);
    });

    setOnline(s.ts);
  }catch(e){ console.error(e); }
}

async function loadEquity(){
  try{
    const csv = await fetchCSV(`data/equity.csv?ts=${Date.now()}`);
    const lines = csv.trim().split("\n");
    const rows = lines.slice(1).map(l=>{
      const [ts,eq] = l.split(",");
      return { x:new Date(ts), y: parseFloat(eq) };
    });
    chart.data.datasets[0].data = rows;
    chart.update();
  }catch(e){ console.error(e); }
}

async function fetchJSON(u){ 
  const r = await fetch(`${u}?_=${Date.now()}`, { cache: 'no-store' });
  if(!r.ok) throw new Error(r.statusText);
  return r.json();
}

async function tick(){
  await loadState();
  await loadEquity();
}
window.addEventListener("load", async ()=>{
  initChart();
  await tick();
  setInterval(tick, 60000); // 1 min
});

.dot{display:inline-block;width:10px;height:10px;border-radius:50%;vertical-align:middle;margin-right:6px;background:#ef4444}
.dot.online{background:#16a34a}
.dot.stale{background:#f59e0b}
.dot.offline{background:#ef4444}
