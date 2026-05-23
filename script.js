/* ═══════════════════════════════════════════════════════════
   LUDO GAME — app.js
   Fully vanilla JS. No frameworks. Works with index.html + style.css
═══════════════════════════════════════════════════════════ */

"use strict";

/* ─── CONSTANTS ──────────────────────────────────────────── */
const PC   = ["#ff3355","#00ff88","#00d4ff","#ffcc00"]; // player colors
const PD   = ["#8b0022","#006633","#005577","#886600"]; // dark variants
const PN   = ["Red","Green","Blue","Yellow"];            // default names
const CELL = 30;
const SZ   = 15 * CELL; // 450px board

/* 52-step outer path [row, col] */
const PATH = [
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],
  [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],
  [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],
];
const SAFE      = new Set([0,8,13,18,26,31,38,43]);
const START_IDX = [0,13,26,39];

/* Home column paths (6 steps each leading to center) */
const HOME_COLS = [
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
];

/* Yard token positions */
const YARD_SLOTS = [
  [[1,1],[1,3],[3,1],[3,3]],
  [[1,11],[1,13],[3,11],[3,13]],
  [[11,11],[11,13],[13,11],[13,13]],
  [[11,1],[11,3],[13,1],[13,3]],
];

const DICE_FACE = ["","⚀","⚁","⚂","⚃","⚄","⚅"];

/* ─── GAME STATE ─────────────────────────────────────────── */
let state = {
  numP    : 4,
  pNames  : ["Red","Green","Blue","Yellow"],
  toks    : [],   // toks[player][token] = { pos, hs, done }
  turn    : 0,
  dice    : null,
  rolled  : false,
  rolling : false,
  movable : [],
  winner  : null,
  log     : [],
  rooms   : [],
  myRoom  : null,
};

function initToks() {
  return Array(4).fill(null).map(() =>
    Array(4).fill(null).map(() => ({ pos:-1, hs:0, done:false }))
  );
}

/* ─── UTILS ──────────────────────────────────────────────── */
const mkId  = () => "RM" + Math.random().toString(36).slice(2,7).toUpperCase();
const $     = id => document.getElementById(id);
const show  = el => el.classList.remove("hidden");
const hide  = el => el.classList.add("hidden");

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.toggle("active", s.id === "screen-" + name);
  });
}

function addLog(msg) {
  state.log.unshift(msg);
  if (state.log.length > 12) state.log.pop();
  renderLog();
}

/* ─── BOARD DRAWING ──────────────────────────────────────── */
const canvas = $("board-canvas");
const ctx    = canvas.getContext("2d");
canvas.width  = SZ;
canvas.height = SZ;

function cellFill(r, c) {
  if (r>=6&&r<=8&&c>=6&&c<=8) return (r===7&&c===7) ? "#0d1f0d" : "#111827";
  if (r<=5&&c<=5) return (r>=1&&r<=4&&c>=1&&c<=4) ? "#ff335518" : "#0a1525";
  if (r<=5&&c>=9) return (r>=1&&r<=4&&c>=10&&c<=13) ? "#00ff8818" : "#0a1525";
  if (r>=9&&c>=9) return (r>=10&&r<=13&&c>=10&&c<=13) ? "#00d4ff18" : "#0a1525";
  if (r>=9&&c<=5) return (r>=10&&r<=13&&c>=1&&c<=4) ? "#ffcc0018" : "#0a1525";
  if (r===7&&c>=1&&c<=5) return "#ff335528";
  if (c===7&&r>=1&&r<=5) return "#00ff8828";
  if (r===7&&c>=9&&c<=13) return "#00d4ff28";
  if (c===7&&r>=9&&r<=13) return "#ffcc0028";
  return "#0a1525";
}
function cellStroke(r, c) {
  if (r===7&&c>=1&&c<=5) return "#ff335544";
  if (c===7&&r>=1&&r<=5) return "#00ff8844";
  if (r===7&&c>=9&&c<=13) return "#00d4ff44";
  if (c===7&&r>=9&&r<=13) return "#ffcc0044";
  return "#152235";
}

function drawBoard() {
  ctx.clearRect(0, 0, SZ, SZ);

  /* Cells */
  for (let r=0; r<15; r++) {
    for (let c=0; c<15; c++) {
      ctx.fillStyle = cellFill(r,c);
      ctx.strokeStyle = cellStroke(r,c);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.roundRect(c*CELL, r*CELL, CELL, CELL, 1);
      ctx.fill(); ctx.stroke();

      /* Safe star */
      const pi = PATH.findIndex(([pr,pc]) => pr===r && pc===c);
      if (pi >= 0 && SAFE.has(pi)) {
        ctx.fillStyle = "#ffcc0066";
        ctx.font = "9px serif";
        ctx.textAlign = "center";
        ctx.fillText("★", c*CELL + CELL/2, r*CELL + CELL/2 + 4);
      }
    }
  }

  /* Yard boxes */
  const yards = [{p:0,rx:1,ry:1},{p:1,rx:9,ry:1},{p:2,rx:9,ry:9},{p:3,rx:1,ry:9}];
  yards.forEach(({p,rx,ry}) => {
    ctx.strokeStyle = PC[p];
    ctx.fillStyle = PC[p] + "15";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(rx*CELL, ry*CELL, 4*CELL, 4*CELL, 6);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = PC[p];
    ctx.globalAlpha = 0.4;
    ctx.font = "bold 9px 'Orbitron', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(state.pNames[p]||PN[p], (rx+2)*CELL, (ry+2)*CELL+5);
    ctx.globalAlpha = 1;
  });

  /* Center triangles */
  const cx = 7.5*CELL, cy = 7.5*CELL;
  const tri = [
    {pts:[[6*CELL,6*CELL],[9*CELL,6*CELL],[cx,cy]], c:PC[0]},
    {pts:[[9*CELL,6*CELL],[9*CELL,9*CELL],[cx,cy]], c:PC[1]},
    {pts:[[6*CELL,9*CELL],[9*CELL,9*CELL],[cx,cy]], c:PC[2]},
    {pts:[[6*CELL,6*CELL],[6*CELL,9*CELL],[cx,cy]], c:PC[3]},
  ];
  tri.forEach(({pts,c}) => {
    ctx.fillStyle = c + "44";
    ctx.strokeStyle = c;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  });

  /* Center star */
  ctx.fillStyle = "#ffcc00";
  ctx.globalAlpha = 0.75;
  ctx.font = "18px serif";
  ctx.textAlign = "center";
  ctx.fillText("★", SZ/2, SZ/2+7);
  ctx.globalAlpha = 1;

  /* Tokens */
  for (let pl=0; pl<state.numP; pl++) {
    state.toks[pl].forEach((tok,ti) => {
      const {x,y} = getXY(pl,ti);
      const canMove = state.rolled && state.movable.includes(ti) && state.turn===pl && !state.winner;

      /* Glow ring */
      if (canMove) {
        ctx.fillStyle = PC[pl] + "30";
        ctx.beginPath();
        ctx.arc(x, y, 13, 0, Math.PI*2);
        ctx.fill();
      }
      /* Outer circle */
      ctx.fillStyle = PD[pl];
      ctx.strokeStyle = PC[pl];
      ctx.lineWidth = canMove ? 2.2 : 1.5;
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI*2); ctx.fill(); ctx.stroke();

      /* Inner circle */
      ctx.fillStyle = PC[pl];
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;

      /* Highlight */
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath(); ctx.arc(x-2, y-2, 1.8, 0, Math.PI*2); ctx.fill();

      /* Number */
      ctx.fillStyle = "white";
      ctx.font = "bold 7px 'Share Tech Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(ti+1, x, y+3.5);
    });
  }
}

function getXY(pl, ti) {
  const t = state.toks[pl][ti];
  if (t.done) {
    const os = [[-5,-5],[-5,5],[5,-5],[5,5]];
    return { x: SZ/2+os[ti][0], y: SZ/2+os[ti][1] };
  }
  if (t.pos === -1) {
    const [yr,yc] = YARD_SLOTS[pl][ti];
    return { x: yc*CELL+CELL/2, y: yr*CELL+CELL/2 };
  }
  if (t.pos === 99 && t.hs > 0) {
    const s = Math.min(t.hs-1, 5);
    const [hr,hc] = HOME_COLS[pl][s];
    const o = ti%2===0 ? -4 : 4;
    return { x: hc*CELL+CELL/2+o, y: hr*CELL+CELL/2+o };
  }
  if (t.pos >= 0 && t.pos < PATH.length) {
    const [r,c] = PATH[t.pos];
    const o = ti%2===0 ? -4 : 4;
    return { x: c*CELL+CELL/2+o, y: r*CELL+CELL/2+o };
  }
  return { x: SZ/2, y: SZ/2 };
}

/* ─── CANVAS CLICK → MOVE TOKEN ─────────────────────────── */
canvas.addEventListener("click", e => {
  if (!state.rolled || state.winner) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = SZ / rect.width;
  const scaleY = SZ / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top)  * scaleY;
  const pl = state.turn;
  let hit = -1;
  state.toks[pl].forEach((tok, ti) => {
    if (!state.movable.includes(ti)) return;
    const {x,y} = getXY(pl,ti);
    if (Math.hypot(mx-x, my-y) <= 14) hit = ti;
  });
  if (hit >= 0) moveToken(pl, hit);
});

/* ─── DICE ───────────────────────────────────────────────── */
let rollTimer = null;

function rollDice() {
  if (state.rolled || state.rolling || state.winner) return;
  state.rolling = true;
  updateDiceUI();
  let ct = 0;
  rollTimer = setInterval(() => {
    state.dice = Math.ceil(Math.random()*6);
    $("dice-face").textContent = DICE_FACE[state.dice];
    ct++;
    if (ct > 10) {
      clearInterval(rollTimer);
      state.dice = Math.ceil(Math.random()*6);
      $("dice-face").textContent = DICE_FACE[state.dice];
      state.rolling = false;
      state.rolled  = true;
      calcMovable(state.dice);
      updateDiceUI();
    }
  }, 75);
}

function calcMovable(d) {
  const pl = state.turn;
  const mv = [];
  state.toks[pl].forEach((t,i) => {
    if (t.done) return;
    if (t.pos === -1 && d === 6) { mv.push(i); return; }
    if (t.pos >= 0 && t.hs === 0) { mv.push(i); return; }
    if (t.pos === 99 && t.hs > 0 && t.hs+d <= 6) mv.push(i);
  });
  state.movable = mv;
  if (mv.length === 0) {
    addLog(`${state.pNames[state.turn]||PN[state.turn]}: no moves — skip`);
    setTimeout(() => nextTurn(false), 800);
  }
  drawBoard();
  updateDiceUI();
}

/* ─── MOVE TOKEN ─────────────────────────────────────────── */
function moveToken(pl, ti) {
  if (!state.rolled || !state.movable.includes(ti) || state.winner || pl!==state.turn) return;
  const d   = state.dice;
  const tok = state.toks[pl][ti];
  const name = state.pNames[pl]||PN[pl];
  let extra = d === 6;

  if (tok.pos === -1 && d === 6) {
    tok.pos = START_IDX[pl];
    addLog(`${name} T${ti+1} enters! 🚀`);
  } else if (tok.pos === 99 && tok.hs > 0) {
    tok.hs += d;
    if (tok.hs >= 6) { tok.done=true; tok.hs=6; addLog(`🏠 ${name} T${ti+1} home!`); }
    else addLog(`${name} T${ti+1} → home step ${tok.hs}`);
  } else if (tok.pos >= 0) {
    const steps = (tok.pos - START_IDX[pl] + 52) % 52;
    if (steps + d >= 52) {
      tok.hs  = steps + d - 52 + 1;
      tok.pos = 99;
      if (tok.hs >= 6) { tok.done=true; tok.hs=6; addLog(`🏠 ${name} T${ti+1} home!`); }
      else addLog(`${name} T${ti+1} enters home col`);
    } else {
      tok.pos = (tok.pos + d) % 52;
      /* Capture */
      for (let p=0; p<state.numP; p++) {
        if (p===pl) continue;
        state.toks[p].forEach((ot,oi) => {
          if (!ot.done && ot.pos===tok.pos && !SAFE.has(tok.pos)) {
            state.toks[p][oi] = { pos:-1, hs:0, done:false };
            addLog(`💥 ${name} captured ${state.pNames[p]||PN[p]} T${oi+1}!`);
            extra = true;
          }
        });
      }
      addLog(`${name} T${ti+1} moved +${d}`);
    }
  }

  state.rolled  = false;
  state.movable = [];
  state.dice    = null;

  /* Win check */
  if (state.toks[pl].every(t => t.done)) {
    state.winner = pl;
    addLog(`🏆 ${name} WINS!`);
    drawBoard();
    renderTabs();
    showWin(pl);
    return;
  }

  if (extra) { addLog(`🎲 ${name} rolls again!`); }
  else        { nextTurn(false); }

  drawBoard();
  renderTabs();
  updateDiceUI();
  updateTopBar();
}

function nextTurn(extra) {
  if (!extra) state.turn = (state.turn+1) % state.numP;
  state.rolled  = false;
  state.movable = [];
  state.dice    = null;
  drawBoard();
  renderTabs();
  updateDiceUI();
  updateTopBar();
}

/* ─── RENDER ─────────────────────────────────────────────── */
function renderTabs() {
  const el = $("player-tabs");
  el.innerHTML = "";
  for (let p=0; p<state.numP; p++) {
    const active = p===state.turn && !state.winner;
    const done   = state.toks[p].filter(t=>t.done).length;
    const div    = document.createElement("div");
    div.className = "player-tab" + (active?" active":"");
    div.style.setProperty("--pc",    PC[p]);
    div.style.setProperty("--pc-bg", PC[p]+"20");

    const dot = document.createElement("div");
    dot.className = "tab-dot";
    dot.style.background = PC[p];
    dot.style.boxShadow  = active ? `0 0 6px ${PC[p]}` : "none";

    const nm  = document.createElement("span");
    nm.className = "tab-name";
    nm.textContent = state.pNames[p]||PN[p];

    const pips = document.createElement("div");
    pips.className = "tab-pips";
    state.toks[p].forEach(t => {
      const pip = document.createElement("div");
      pip.className = "tab-pip" + (t.done?" done":t.pos>=0?" on-board":"");
      pip.style.setProperty("--pc", PC[p]);
      pips.appendChild(pip);
    });

    const sc  = document.createElement("span");
    sc.className = "tab-score";
    sc.style.color = PC[p];
    sc.textContent = done+"/4";

    div.append(dot, nm, pips, sc);
    el.appendChild(div);
  }
}

function renderLog() {
  const el = $("log-list");
  el.innerHTML = "";
  state.log.forEach((msg,i) => {
    const d = document.createElement("div");
    d.className = "log-entry " + (i===0?"latest":"old");
    d.textContent = msg;
    el.appendChild(d);
  });
}

function updateDiceUI() {
  const box  = $("dice-box");
  const btn  = $("btn-roll");
  const hint = $("dice-hint");
  const face = $("dice-face");

  box.style.borderColor = PC[state.turn]+"55";
  btn.style.background  = `linear-gradient(135deg,${PD[state.turn]},${PC[state.turn]})`;

  if (state.rolling) {
    btn.textContent  = "...";
    btn.disabled     = true;
    hint.textContent = "";
    hint.style.color = "";
  } else if (state.rolled) {
    btn.textContent  = "DONE";
    btn.disabled     = true;
    hint.textContent = state.movable.length > 0 ? "PICK!" : "SKIP";
    hint.style.color = state.movable.length > 0 ? "#00ff88" : "#ff3355";
    face.style.filter= `drop-shadow(0 0 7px ${PC[state.turn]}99)`;
  } else {
    face.textContent = state.dice ? DICE_FACE[state.dice] : "🎲";
    face.style.filter= "none";
    btn.textContent  = "ROLL";
    btn.disabled     = !!state.winner;
    hint.textContent = "";
  }
}

function updateTopBar() {
  const tb  = $("turn-badge");
  const pl  = state.turn;
  if (state.winner !== null) {
    const w = state.winner;
    tb.textContent       = `🏆 ${state.pNames[w]||PN[w]} Wins!`;
    tb.style.background  = "#ffcc0018";
    tb.style.border      = "1px solid #ffcc0044";
    tb.style.color       = "#ffcc00";
  } else {
    tb.textContent       = `● ${state.pNames[pl]||PN[pl]}`;
    tb.style.background  = PC[pl]+"22";
    tb.style.border      = `1px solid ${PC[pl]}55`;
    tb.style.color       = PC[pl];
  }
}

/* ─── WIN OVERLAY ────────────────────────────────────────── */
function showWin(pl) {
  const ov  = $("win-overlay");
  const wc  = $("win-card");
  const nm  = $("win-name");
  nm.textContent       = (state.pNames[pl]||PN[pl]) + " WINS!";
  nm.style.color       = PC[pl];
  nm.style.textShadow  = `0 0 16px ${PC[pl]}`;
  wc.style.borderColor = PC[pl];
  wc.style.boxShadow   = `0 0 40px ${PC[pl]}55`;
  show(ov);
}

/* ─── START / RESET ──────────────────────────────────────── */
function startGame() {
  state.toks    = initToks();
  state.turn    = 0;
  state.dice    = null;
  state.rolled  = false;
  state.rolling = false;
  state.movable = [];
  state.winner  = null;
  state.log     = ["Game started! " + (state.pNames[0]||"Red") + " goes first."];
  hide($("win-overlay"));
  $("dice-face").textContent = "🎲";
  renderTabs();
  renderLog();
  updateDiceUI();
  updateTopBar();
  drawBoard();
  renderTabs();
}

/* ─── SETUP SCREEN ───────────────────────────────────────── */
function buildPlayerInputs() {
  const el = $("player-inputs");
  el.innerHTML = "";
  for (let i=0; i<state.numP; i++) {
    const row = document.createElement("div");
    row.className = "player-row";
    const dot = document.createElement("div");
    dot.className   = "player-dot";
    dot.style.background = PC[i];
    const inp = document.createElement("input");
    inp.className   = "player-input";
    inp.style.color = PC[i];
    inp.value       = state.pNames[i]||PN[i];
    inp.addEventListener("input", e => { state.pNames[i] = e.target.value; });
    row.append(dot, inp);
    el.appendChild(row);
  }
}

/* Num buttons */
$("num-select").addEventListener("click", e => {
  const btn = e.target.closest(".num-btn");
  if (!btn) return;
  const n = parseInt(btn.dataset.n);
  state.numP = n;
  document.querySelectorAll(".num-btn").forEach(b =>
    b.classList.toggle("active", parseInt(b.dataset.n)===n)
  );
  buildPlayerInputs();
});

$("btn-local").addEventListener("click", () => {
  state.myRoom = null;
  showScreen("game");
  updateRoomBadge();
  startGame();
});

$("btn-online").addEventListener("click", () => {
  showScreen("lobby");
  renderRooms();
});

/* ─── LOBBY ──────────────────────────────────────────────── */
$("lobby-back").addEventListener("click", () => showScreen("setup"));

$("btn-create").addEventListener("click", () => {
  const name = $("room-name-input").value.trim();
  if (!name) return;
  const r = { id:mkId(), name, host:state.pNames[0]||"Player", numP:state.numP, status:"waiting" };
  state.rooms.unshift(r);
  state.myRoom = r;
  $("room-name-input").value = "";
  renderRooms();
  showScreen("game");
  updateRoomBadge();
  startGame();
});

$("btn-join").addEventListener("click", () => {
  const id  = $("join-id-input").value.trim().toUpperCase();
  const err = $("join-err");
  const inp = $("join-id-input");
  const r   = state.rooms.find(x => x.id===id);
  if (!r) {
    err.textContent = "❌ Room not found";
    inp.classList.add("err");
    return;
  }
  err.textContent = "";
  inp.classList.remove("err");
  inp.value    = "";
  state.myRoom = r;
  showScreen("game");
  updateRoomBadge();
  startGame();
});

$("join-id-input").addEventListener("input", () => {
  $("join-err").textContent = "";
  $("join-id-input").classList.remove("err");
  $("join-id-input").value = $("join-id-input").value.toUpperCase();
});

function renderRooms() {
  const el  = $("room-list");
  const cnt = $("room-count");
  cnt.textContent = state.rooms.length;
  el.innerHTML = "";
  if (state.rooms.length===0) {
    el.innerHTML = '<p class="empty-msg">No rooms yet.</p>';
    return;
  }
  state.rooms.forEach(r => {
    const div = document.createElement("div");
    div.className = "room-item";
    div.innerHTML = `
      <div style="flex:1">
        <div class="room-item-name">${r.name}</div>
        <div class="room-item-id">${r.id}</div>
      </div>
      <span class="room-item-np">${r.numP}P</span>
      <div class="room-online-dot"></div>
    `;
    el.appendChild(div);
  });
}

function updateRoomBadge() {
  const badge = $("room-badge");
  const idBox = $("room-id-box");
  const lBtn  = $("btn-leave");
  if (state.myRoom) {
    badge.textContent = state.myRoom.id;
    show(badge); show(idBox);
    $("room-id-display").textContent = state.myRoom.id;
    lBtn.textContent = "🚪 Leave";
  } else {
    hide(badge); hide(idBox);
    lBtn.textContent = "← Setup";
  }
}

/* ─── GAME BUTTONS ───────────────────────────────────────── */
$("btn-roll").addEventListener("click", rollDice);

$("btn-leave").addEventListener("click", () => {
  if (state.myRoom) {
    state.rooms = state.rooms.filter(r => r.id !== state.myRoom.id);
    state.myRoom = null;
    showScreen("lobby");
    renderRooms();
  } else {
    showScreen("setup");
  }
  startGame();
  updateRoomBadge();
});

$("btn-new").addEventListener("click", startGame);

$("btn-again").addEventListener("click", startGame);

$("btn-setup").addEventListener("click", () => {
  state.myRoom = null;
  showScreen("setup");
  buildPlayerInputs();
  startGame();
  updateRoomBadge();
});

/* ─── INIT ───────────────────────────────────────────────── */
buildPlayerInputs();
drawBoard();