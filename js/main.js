// Forbidden Fruit — ядро одиночной игры (canvas-рендер, физика, ввод).
// Сетевой клиент (js/net/net-client.js) подключается поверх этого ядра.
"use strict";

const WORLD_SIZE = 40;
const FRUIT_COUNT = 7;
const MAX_HEARTS = 3;

const WORLDS = {
  meadow:  { name: "Луговина",        sky: "#87b6d9", ground: "#3f7d4e", tree: "#2c5a38" },
  hollow:  { name: "Дупло",           sky: "#6b7fa3", ground: "#4a6a45", tree: "#31462f" },
  mistfen: { name: "Туманное болото", sky: "#5d6b74", ground: "#3a5550", tree: "#26403c" },
};

// ---------- утилиты ГЛОБАЛЬНОЙ области (доступны сетевому клиенту) ----------
window.WORLD_SIZE = WORLD_SIZE;
window.FRUIT_COUNT = FRUIT_COUNT;
window.WORLDS = WORLDS;

// Глобальный объект игры: его читает и обновляет net-client.
const game = {
  mode: "menu",            // menu | solo | net
  paused: false,
  hearts: MAX_HEARTS,
  fox: { x: 0, y: 0, z: 0, ry: 0, vx: 0, vz: 0, run: false },
  fruits: [],              // [{id,x,y,z,taken}]
  collected: 0,
  portalOpen: false,
  spirit: { x: 0, y: 0, z: -10, active: true },
  worldKey: "meadow",
  remoteFoxes: {},         // id -> {x,y,z,ry,name,team,tx,tz} интерполяция
  net: null,               // сетевой клиент (net-client.js)
};
window.game = game;

// ---------- canvas ----------
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener("resize", resize); resize();

// ---------- ввод ----------
const keys = {};
addEventListener("keydown", e => {
  keys[e.code] = true;
  if (e.code === "KeyP" && game.mode !== "menu") togglePause();
  if (e.code === "KeyE") tryCollectNearestFruit();
});
addEventListener("keyup", e => { keys[e.code] = false; });

function togglePause() {
  game.paused = !game.paused;
  toast(game.paused ? "Пауза ⏸ (личная, друзья продолжают играть)" : "Продолжаем! ▶");
}

// ---------- мир (одиночная игра генерирует сама; сеть — сервером) ----------
function makeSoloWorld(worldKey) {
  game.worldKey = worldKey in WORLDS ? worldKey : "meadow";
  game.fruits = [];
  for (let i = 0; i < FRUIT_COUNT; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 6 + Math.random() * (WORLD_SIZE * 0.4);
    game.fruits.push({ id: i, x: Math.cos(ang) * rad, y: 0, z: Math.sin(ang) * rad, taken: false });
  }
  game.collected = 0;
  game.portalOpen = false;
  game.hearts = MAX_HEARTS;
  game.spirit = { x: 0, y: 0, z: -10, active: true };
  Object.assign(game.fox, { x: 0, y: 0, z: 0, ry: 0 });
  updateHud();
}

// ---------- действия ----------
function tryCollectNearestFruit() {
  if (game.mode === "menu" || game.paused) return;
  let best = null, bd = 2.2;
  for (const f of game.fruits) {
    if (f.taken) continue;
    const d = Math.hypot(f.x - game.fox.x, f.z - game.fox.z);
    if (d < bd) { bd = d; best = f; }
  }
  if (!best) return;
  if (game.net && game.mode === "net") {
    game.net.send({ type: "collect", fruit: best.id }); // сервер подтвердит снапшотом
  } else {
    best.taken = true;
    game.collected++;
    toast(`Запретный плод сорван ✦ (${game.collected}/${FRUIT_COUNT})`);
    checkPortalSolo();
    updateHud();
  }
}

function checkPortalSolo() {
  if (game.collected >= FRUIT_COUNT && !game.portalOpen) {
    game.portalOpen = true;
    toast("Все плоды собраны — портал открылся! 🌀");
  }
}

// ---------- HUD / тосты ----------
const elHearts = document.getElementById("hearts");
const elCounter = document.getElementById("fruit-counter");
const elToast = document.getElementById("toast");
const elNetStatus = document.getElementById("net-status");
const elWorldName = document.getElementById("world-name");
let toastTimer = 0;

function toast(msg) {
  elToast.textContent = msg;
  elToast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elToast.classList.remove("show"), 2600);
}
window.toast = toast;

function updateHud() {
  elHearts.textContent = "♥ ".repeat(Math.max(0, game.hearts)) + "♡ ".repeat(MAX_HEARTS - Math.max(0, game.hearts));
  elCounter.textContent = `🍎 ${game.collected} / ${FRUIT_COUNT}`;
  elWorldName.textContent = (WORLDS[game.worldKey] || WORLDS.meadow).name;
}
window.updateHud = updateHud;

function setNetStatus(n) {
  if (game.mode === "net") {
    elNetStatus.classList.remove("hidden");
    elNetStatus.textContent = `🟢 игроков: ${n}`;
  } else {
    elNetStatus.classList.add("hidden");
  }
}
window.setNetStatus = setNetStatus;

// ---------- обновление удалённых лисят (сетевой режим) ----------
function updateRemoteFoxes(dt) {
  for (const id in game.remoteFoxes) {
    const r = game.remoteFoxes[id];
    const k = Math.min(1, dt * 8);
    r.x += (r.tx - r.x) * k;
    r.z += (r.tz - r.z) * k;
    r.ry = r.try !== undefined ? r.try : r.ry;
  }
}
window.updateRemoteFoxes = updateRemoteFoxes;

// ---------- цикл ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.mode !== "menu" && !game.paused) step(dt);
  render();
  requestAnimationFrame(loop);
}

function step(dt) {
  const f = game.fox;
  let mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) mz -= 1;
  if (keys.KeyS || keys.ArrowDown) mz += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  const run = (keys.ShiftLeft || keys.ShiftRight) ? 1.8 : 1;
  const sp = 6 * run;
  if (mx || mz) {
    const l = Math.hypot(mx, mz);
    f.x += (mx / l) * sp * dt;
    f.z += (mz / l) * sp * dt;
    f.ry = Math.atan2(mx, -mz);
  }
  const lim = WORLD_SIZE * 0.5;
  f.x = Math.max(-lim, Math.min(lim, f.x));
  f.z = Math.max(-lim, Math.min(lim, f.z));

  // дух тумана преследует ближайшего живого игрока
  if (game.spirit.active) {
    const dx = f.x - game.spirit.x, dz = f.z - game.spirit.z;
    const d = Math.hypot(dx, dz) || 1;
    game.spirit.x += (dx / d) * 2.6 * dt;
    game.spirit.z += (dz / d) * 2.6 * dt;
    if (d < 1.4 && !game._hitCd) {
      game._hitCd = performance.now() + 1200;
      if (game.mode === "net" && game.net) game.net.send({ type: "hit" });
      else applySoloHit();
    }
  }
  if (game._hitCd && performance.now() > game._hitCd) game._hitCd = 0;

  // портал
  if (game.portalOpen) {
    const pd = Math.hypot(f.x, f.z);
    if (pd < 1.6) winGame();
  }

  if (game.mode === "net") {
    updateRemoteFoxes(dt);
    if (game.net) game.net.throttlePos(f);
  }
}

function applySoloHit() {
  game.hearts--;
  updateHud();
  if (game.hearts <= 0) loseGame();
  else toast("Дух тумана задел тебя 💢");
}

function winGame() {
  if (game.mode === "net" && game.net) { game.net.send({ type: "portal" }); return; }
  showFinal(true);
}
window.winGameFromNet = () => showFinal(true);
window.loseGame = () => showFinal(false);

function showFinal(win) {
  game.mode = game.mode === "net" ? "net" : "solo";
  document.getElementById("final-screen").classList.remove("hidden");
  document.getElementById("final-title").textContent = win ? "Победа! 🏆" : "Туман поглотил лесину… 🌫";
  document.getElementById("final-text").textContent = win
    ? "Команда добралась до портала. Все запретные плоды спасены от соблазна!"
    : "Сердца закончились. Друзья могут продолжить прогулку без тебя.";
}

// ---------- рендер (простой псевдо-3D) ----------
function project(x, z, y = 0) {
  const f = game.fox;
  const c = Math.cos(-f.ry), s = Math.sin(-f.ry);
  const rx = (x - f.x) * c - (z - f.z) * s;
  const rz = (x - f.x) * s + (z - f.z) * c;
  const depth = rz + 0.001;
  if (depth > -0.4) return null;
  const W = canvas.width, H = canvas.height;
  const sc = (-6 / depth);
  return { sx: W / 2 + rx * sc * (W / 6), sy: H / 2 - (y + 1.2) * sc * (W / 6) * 0.5, scale: sc };
}

function render() {
  const w = WORLDS[game.worldKey] || WORLDS.meadow;
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = w.sky; ctx.fillRect(0, 0, W, H * 0.55);
  ctx.fillStyle = w.ground; ctx.fillRect(0, H * 0.55, W, H * 0.45);
  if (game.mode === "menu") return;

  // плоды
  for (const fr of game.fruits) {
    if (fr.taken) continue;
    const p = project(fr.x, fr.z, 0.6);
    if (!p) continue;
    ctx.fillStyle = "#d94f4f";
    ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(2, 14 / p.scale * -0.2), 0, 7); ctx.fill();
    ctx.strokeStyle = "#ffe9a8"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(4, 18 / p.scale * -0.2), 0, 7); ctx.stroke();
  }

  // портал
  if (game.portalOpen) {
    const p = project(0, -WORLD_SIZE * 0.45, 1.5);
    if (p) {
      ctx.strokeStyle = "#8be8ff"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(6, 60 / -p.scale), 0, 7); ctx.stroke();
    }
  }

  // удалённые лисята
  for (const id in game.remoteFoxes) {
    const r = game.remoteFoxes[id];
    const p = project(r.x, r.z, 0.5);
    if (!p) continue;
    const sz = Math.max(3, 40 / -p.scale);
    ctx.fillStyle = teamHex(r.team);
    ctx.beginPath(); ctx.arc(p.sx, p.sy, sz * 0.5, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(r.name, p.sx, p.sy - sz);
  }

  // дух тумана
  if (game.spirit.active) {
    const p = project(game.spirit.x, game.spirit.z, 1.2);
    if (p) {
      ctx.fillStyle = "rgba(40,45,60,.75)";
      ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(6, 80 / -p.scale), 0, 7); ctx.fill();
    }
  }

  // свой лисёнок — не рисуем (вид от первого лица), рисуем лапы
  ctx.fillStyle = "#e8763a";
  ctx.beginPath(); ctx.arc(W * 0.25, H * 0.92, 26, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(W * 0.75, H * 0.92, 26, 0, 7); ctx.fill();
}

function teamHex(team) {
  return { red: "#e8763a", sand: "#e8c07a", silver: "#b9c4cf", coal: "#4a4f5a" }[team] || "#e8763a";
}
window.teamHex = teamHex;

// ---------- экраны / кнопки ----------
const scrMenu = document.getElementById("menu-screen");
const scrLobby = document.getElementById("lobby-screen");
const scrFinal = document.getElementById("final-screen");
const scrHud = document.getElementById("hud");

document.getElementById("btn-solo").onclick = () => {
  game.mode = "solo";
  makeSoloWorld("meadow");
  scrMenu.classList.add("hidden");
  scrHud.classList.remove("hidden");
};

document.getElementById("btn-net").onclick = () => {
  scrMenu.classList.add("hidden");
  scrLobby.classList.remove("hidden");
  const lbl = document.getElementById("lobby-addr-label");
  if (lbl) lbl.textContent = location.host;
};

document.getElementById("btn-back-menu").onclick = () => {
  scrLobby.classList.add("hidden");
  scrMenu.classList.remove("hidden");
  if (game.net) game.net.close();
};

document.querySelectorAll("#lbTeams .team").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll("#lbTeams .team").forEach(x => x.classList.remove("selected"));
    b.classList.add("selected");
  };
});

document.getElementById("btn-join").onclick = () => {
  const name = document.getElementById("lbName").value.trim() || "лисёнок";
  const teamBtn = document.querySelector("#lbTeams .team.selected");
  const team = teamBtn ? teamBtn.dataset.team : "red";
  const world = document.getElementById("lbWorld").value;
  // net-client.js подхватит параметры и подключится к location.host автоматически
  window.dispatchEvent(new CustomEvent("ff-join", { detail: { name, team, world } }));
};

document.getElementById("btn-final-restart").onclick = () => {
  scrFinal.classList.add("hidden");
  if (game.mode === "net" && game.net) game.net.restartWorld();
  else makeSoloWorld(game.worldKey);
};
document.getElementById("btn-final-menu").onclick = () => {
  scrFinal.classList.add("hidden");
  scrHud.classList.add("hidden");
  scrMenu.classList.remove("hidden");
  game.mode = "menu";
  if (game.net) game.net.close();
};

requestAnimationFrame(loop);
console.log("Forbidden Fruit core loaded.");
