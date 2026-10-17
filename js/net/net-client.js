// Forbidden Fruit — сетевой клиент.
// КЛЮЧЕВОЕ: адрес сервера НЕ вводится — берётся прямо из ссылки, по которой
// игрок открыл игру (location.host). То есть все подключаются к одному IP:порту хоста.
"use strict";

(function () {
  const game = window.game;
  if (!game) { console.error("net-client: ядро игры не загружено"); return; }

  let ws = null;
  let myId = null;
  let reconnectTimer = null;
  let lastPosSent = 0;
  let joinParams = null;
  let closedByUser = false;

  function serverUrl() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    // location.host = "IP:порт" страницы, с которой открыта игра
    return `${proto}//${location.host}/ws`;
  }

  function connect(params) {
    closedByUser = false;
    joinParams = params;
    const msg = document.getElementById("lobby-msg");
    if (msg) msg.textContent = "Подключение к " + location.host + " …";
    try {
      ws = new WebSocket(serverUrl());
    } catch (e) {
      lobbyFail("Не удалось открыть соединение: " + e.message);
      return;
    }

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", ...params }));
      if (msg) msg.textContent = "Соединение установлено ✦";
    };

    ws.onmessage = ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === "hello") { myId = m.id; applyState(m.state); enterGame(); }
      else if (m.type === "state") applyState(m);
      else if (m.type === "bye") { /* сервер закрыл нас */ }
    };

    ws.onclose = () => {
      if (closedByUser) return;
      if (game.mode === "net") {
        toast("Связь с сервером потеряна, переподключение…");
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => connect(joinParams), 1500);
      } else {
        lobbyFail("Сервер не отвечает. Проверьте, что он запущен и брандмауэр разрешает порт.");
      }
    };

    ws.onerror = () => { /* onclose обработает */ };
  }

  function lobbyFail(text) {
    const msg = document.getElementById("lobby-msg");
    if (msg) msg.textContent = text;
  }

  function enterGame() {
    game.mode = "net";
    game.net = api;
    document.getElementById("lobby-screen").classList.add("hidden");
    document.getElementById("hud").classList.remove("hidden");
  }

  // ---------- применение снимка мира ----------
  function applyState(st) {
    if (!st) return;
    game.worldKey = st.world in window.WORLDS ? st.world : game.worldKey;
    game.fruits = st.fruits;
    game.collected = st.collected;
    game.portalOpen = st.portal;
    setNetStatus(st.players.length);

    // свои сердца/жизнь — из списка игроков по моему id
    for (const p of st.players) {
      if (p.id === myId) {
        game.hearts = p.hearts;
        if (!p.alive && !game._lostShown) { game._lostShown = true; window.loseGame(); }
      } else {
        const r = game.remoteFoxes[p.id] || (game.remoteFoxes[p.id] = { x: p.x, z: p.z });
        r.tx = p.x; r.tz = p.z; r.try = p.ry;
        r.name = p.name; r.team = p.team; r.alive = p.alive;
      }
    }
    // убираем отвалившихся
    const ids = new Set(st.players.map(p => p.id));
    for (const id in game.remoteFoxes) if (!ids.has(id)) delete game.remoteFoxes[id];

    // дух тумана — серверный источник истины
    game.spirit.active = !(st.spirit.respawn_at > 0);
    game.spirit.x = st.spirit.x; game.spirit.z = st.spirit.z;

    // события (подсказки всем)
    if (st.evts) for (const e of st.evts) {
      if (e.kind === "hit" && e.who) {
        const me = playerName(e);
        if (me) toast(e.text);
        else toast(e.text);
      } else if (e.text) {
        toast(e.text);
      }
      if (e.kind === "win") window.winGameFromNet();
    }

    updateHudSafe();
  }

  function playerName(e) { return e && e.who; }

  function updateHudSafe() {
    if (typeof window.updateHud === "function") window.updateHud();
  }

  // ---------- исходящие ----------
  const api = {
    send(obj) {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
    },
    throttlePos(f) {
      const now = performance.now();
      if (now - lastPosSent < 80) return; // ~12 Гц
      lastPosSent = now;
      this.send({ type: "pos", x: f.x, y: f.y, z: f.z, ry: f.ry });
    },
    restartWorld(world) {
      game._lostShown = false;
      this.send({ type: "newworld", world: world || game.worldKey });
    },
    close() {
      closedByUser = true;
      clearTimeout(reconnectTimer);
      if (ws) { try { ws.close(); } catch {} ws = null; }
      game.net = null;
      myId = null;
      game.remoteFoxes = {};
      game._lostShown = false;
    },
  };

  window.netClient = api;

  // Лобби шлёт событие ff-join (см. main.js) — подключаемся автоматически
  window.addEventListener("ff-join", e => {
    connect(e.detail);
  });
})();
