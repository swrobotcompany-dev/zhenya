#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FORBIDDEN FRUIT — ОДИН сервер для игры по локальной сети (без зависимостей).

Команда:  python3 server.py [порт]      (по умолчанию порт 8000)

Тот же порт раздаёт и игру, и синхронизацию:
  Игроки открывают в браузере:  http://IP-сервера:8000
  Клиенты сами подключаются по WebSocket на этот же адрес/порт.
Никаких вторых процессов и отдельных адресов — все заходят на IP сервера.
"""
import argparse
import asyncio
import base64
import hashlib
import json
import os
import re
import socket
import struct
import sys
import threading
import time
from collections import deque
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT_DEFAULT = 8000
GUID_MAGIC = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
OP_TEXT, OP_BIN, OP_CLOSE, OP_PING, OP_PONG = 0x1, 0x2, 0x8, 0x9, 0xA

MIME = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8", ".json": "application/json",
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon",
        ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav"}


def unquote(s):
    from urllib.parse import unquote as _u
    try:
        return _u(s)
    except Exception:
        return s


# ============================ СОСТОЯНИЕ ИГРЫ ==============================
class GameState:
    """Единое состояние мира для всех подключённых игроков."""

    def __init__(self):
        self.lock = asyncio.Lock()
        self.players = {}          # ws -> {"id":..,"name":..,"team":..,...}
        self.next_id = 1
        self.seq = 0
        self.events = deque(maxlen=64)   # [(ts, evt), ...] — evt содержит "seq"
        self.worlds_seen = set()
        self.reset("classic")
        self.last_tick = time.monotonic()
        self.spirit_spawned_at = None

    # ----- служебное -----
    def ev(self, kind, **kw):
        self.seq += 1
        kw["kind"] = kind
        kw["seq"] = self.seq
        self.events.append((time.time(), kw))

    def new_fruit_positions(self):
        """Плоды раскидывает СЕРВЕР — у всех игроков они в одних местах."""
        import math
        import random
        used, arr = [], []
        tries = 0
        while len(arr) < 7 and tries < 500:
            tries += 1
            a = random.uniform(0, math.pi * 2)
            r = random.uniform(13, 48)
            x, z = round(math.cos(a) * r, 2), round(math.sin(a) * r, 2)
            if all(math.hypot(u[0] - x, u[1] - z) > 10 for u in used):
                used.append((x, z))
                arr.append([x, z, 1])          # x, z, alive
        return arr

    # ----- команды клиентов -----
    async def join(self, ws, d):
        async with self.lock:
            pid = self.next_id
            self.next_id += 1
            self.players[ws] = {
                "id": pid,
                "name": str(d.get("name", "Лисёнок"))[:16],
                "team": int(d.get("team", 0)) % 4,
                "x": 0.0, "z": 0.0, "yaw": 0.0, "sprint": False,
                "hearts": self.hearts_per_player, "alive": True,
                "evt_seq": self.seq,        # клиент увидит события, случившиеся после входа
            }
            self.ev("join", id=pid, name=self.players[ws]["name"], team=self.players[ws]["team"])
            return pid

    async def leave(self, ws):
        async with self.lock:
            p = self.players.pop(ws, None)
            if p:
                self.ev("leave", id=p["id"], name=p["name"])
                # если все живые игроки выбыли — мир перезапускается сам
                if not any(q["alive"] for q in self.players.values()) and self.state != "over":
                    pass  # reset придёт с 'restart' от любого клиента либо автоматически ниже

    async def update_pos(self, ws, d):
        p = self.players.get(ws)
        if not p:
            return
        try:
            p["x"] = float(d.get("x", p["x"]))
            p["z"] = float(d.get("z", p["z"]))
            p["yaw"] = float(d.get("yaw", p["yaw"]))
            p["sprint"] = bool(d.get("sprint", False))
        except (TypeError, ValueError):
            pass

    async def handle(self, ws, msg):
        """Обработка одного сообщения от клиента. Возвращает строку-ответ или None."""
        t = msg.get("t")
        if t == "join":
            await self.join(ws, msg)
            # если игрок пришёл сразу с выбором мира и он отличается от общего —
            # перестраиваем общий мир под него (остальные увидят newworld в снапшоте)
            want = str(msg.get("world") or "")
            if want and want != self.world and want in WORLDS:
                await self.set_world(want)
            # сразу отправляем приветствие с полным снимком мира —
            # клиент построит лес по тем же плодам, что и у всех
            snap = self.snapshot()
            return {"t": "hello", "id": self.players[ws]["id"],
                    "world": self.world, "snapshot": snap} \
                if ws in self.players else None
        if t == "pos":
            await self.update_pos(ws, msg)
            return None
        if t == "collect":
            return await self._collect(ws, msg)
        if t == "hit":
            return await self._hit(ws, msg)
        if t == "portal":
            return await self._portal(ws, msg)
        if t == "spirit":
            return await self._spirit(msg)
        if t == "newworld":
            return await self._newworld(ws, msg)
        if t == "setworld":
            return await self.set_world(str(msg.get("world", "classic")))
        if t == "restart":
            return await self._restart(msg)
        return None

    # ----- события игрового процесса -----
    async def _collect(self, ws, msg):
        async with self.lock:
            i = int(msg.get("i", -1))
            if 0 <= i < len(self.fruits) and self.fruits[i][2] == 1:
                self.fruits[i][2] = 0
                self.collected += 1
                p = self.players.get(ws)
                pid = p["id"] if p else 0
                self.ev("collect", i=i, by=pid)
                if self.collected >= 7 and not self.portal_open:
                    self.portal_open = True
                    self.state = "portal"
                    self.ev("portal", open=True)
                return None          # изменение попадёт в следующий state-снапшот
            return None

    async def _hit(self, ws, msg):
        async with self.lock:
            p = self.players.get(ws)
            if not p or not p["alive"]:
                return None
            p["hearts"] -= 1
            self.ev("hit", id=p["id"], hearts=max(p["hearts"], 0))
            if p["hearts"] <= 0:
                p["alive"] = False
                self.ev("down", id=p["id"], name=p["name"])
            self.spirit_state = "die"
            self.spirit_die_t = time.monotonic()
            self.respawn_spirit_after(8.0)
            return None

    async def _portal(self, ws, msg):
        async with self.lock:
            if not self.portal_open or self.state == "over":
                return None
            self.state = "over"
            self.winner = "win"
            names = sorted({p["name"] for p in self.players.values()})
            self.ev("end", win=True, players=names)
            return None

    async def _spirit(self, msg):
        async with self.lock:
            st = msg.get("state")
            if st in ("lurk", "chase", "wait"):
                self.spirit_state = st
            return None

    def respawn_spirit_after(self, seconds):
        self.spirit_respawn_at = time.monotonic() + seconds

    async def _restart(self, msg):
        async with self.lock:
            key = str(msg.get("world", "classic"))
            if key not in WORLDS:
                key = "classic"
            self.reset(key)
            for p in self.players.values():
                p["hearts"] = self.hearts_per_player
                p["alive"] = True
                p["x"] = 0.0
                p["z"] = 0.0
            self.ev("restart", world=key)
            return None

    async def _newworld(self, ws, msg):
        """Хост выбирает мир из меню — все игроки перезаходят в него."""
        async with self.lock:
            key = str(msg.get("world", "classic"))
            if key not in WORLDS:
                key = "classic"
            self.reset(key)
            for p in self.players.values():
                p["hearts"] = self.hearts_per_player
                p["alive"] = True
                p["x"] = 0.0
                p["z"] = 0.0
            self.ev("newworld", world=key, by=ws.id if hasattr(ws, "id") else 0)
            return None

    # ----- снапшот для рассылки -----
    def snapshot(self, after_seq=None):
        """after_seq=None — все известные события (для hello);
        иначе — только события с seq > after_seq (выдаём один раз и не теряем)."""
        players = []
        for p in self.players.values():
            players.append({
                "id": p["id"], "name": p["name"], "team": p["team"],
                "x": round(p["x"], 2), "z": round(p["z"], 2), "yaw": round(p["yaw"], 2),
                "sprint": p["sprint"], "hearts": p["hearts"], "alive": p["alive"],
            })
        if after_seq is None:
            new_evts = list(self.events)
        else:
            new_evts = [e for e in self.events if e[1]["seq"] > after_seq]
        return {
            "t": "state",
            "world": self.world,
            "state": self.state,
            "fruits": self.fruits,
            "collected": self.collected,
            "portal": self.portal_open,
            "spirit": {"state": self.spirit_state},
            "players": players,
            "evts": [[round(ts, 3), e] for ts, e in new_evts][-16:],
            "seq": self.seq,
            "clock": time.time(),
        }

    def reset(self, key):
        self.world = key
        self.state = "play"
        self.fruits = self.new_fruit_positions()
        self.collected = 0
        self.portal_open = False
        self.winner = None
        self.hearts_per_player = 3
        self.spirit_state = "off"
        self.spirit_die_t = None
        self.spirit_respawn_at = None
        self.events.clear()

    async def set_world(self, key):
        """Смена мира из меню: если мир уже общий — просто подтверждаем
        (клиент всё равно построит лес по снимку), иначе — полный рестарт."""
        async with self.lock:
            if key not in WORLDS:
                key = "classic"
            if self.world == key and self.state != "over":
                return {"t": "worldok", "world": key}
            self.reset(key)
            for p in self.players.values():
                p["hearts"] = self.hearts_per_player
                p["alive"] = True
                p["x"] = 0.0
                p["z"] = 0.0
            self.ev("newworld", world=key)
            return {"t": "worldok", "world": key}


WORLDS = {"classic", "magic", "autumn"}
GAME = GameState()


# ============================ WEBSOCKET (raw) =============================
def ws_accept(key: bytes) -> bytes:
    return base64.b64encode(hashlib.sha1(key + GUID_MAGIC).digest()).decode()


def encode_frame(payload: str, opcode=OP_TEXT) -> bytes:
    data = payload.encode("utf-8")
    b0 = 0x80 | opcode
    ln = len(data)
    if ln < 126:
        head = struct.pack("!BB", b0, ln)
    elif ln < (1 << 16):
        head = struct.pack("!BBH", b0, 126, ln)
    else:
        head = struct.pack("!BBQ", b0, 127, ln)
    return head + data


class WSProtocol(asyncio.Protocol):
    """Минимальный RFC6455-совместимый WebSocket поверх asyncio."""

    def __init__(self, loop):
        self.loop = loop
        self.transport = None
        self.buf = b""
        self.handshaked = False
        self.http_only = False
        self.closed = False
        self.is_server_side = True

    def connection_made(self, transport):
        self.transport = transport

    def connection_lost(self, exc):
        self.closed = True
        if self.handshaked:                     # HTTP-запросы сюда не доходят — не трогать игру
            asyncio.ensure_future(GAME.leave(self))

    # ---------- handshake ----------
    def _try_handshake(self):
        """True — это WebSocket; False — обычный HTTP (раздать файлы); None — ждать данных."""
        if b"\r\n\r\n" not in self.buf:
            return None
        head, rest = self.buf.split(b"\r\n\r\n", 1)
        self.buf = rest
        try:
            lines = head.decode("latin-1").split("\r\n")
            fields = {}
            for line in lines[1:]:
                if ":" in line:
                    k, v = line.split(":", 1)
                    fields[k.strip().lower()] = v.strip()
            key = fields.get("sec-websocket-key")
            upgrade = fields.get("upgrade", "")
            if not key or "websocket" not in upgrade.lower():
                self.http_only = True           # обычный запрос: раздать файлы и закрыть
                self._serve_http(head)          # браузер открыл игру по http://
                return False
        except Exception:
            self.transport.write(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n")
            self.transport.close()
            return False
        accept = ws_accept(key.encode("latin-1"))
        self.transport.write(
            ("HTTP/1.1 101 Switching Protocols\r\n"
             "Upgrade: websocket\r\nConnection: Upgrade\r\n"
             "Sec-WebSocket-Accept: %s\r\n\r\n" % accept).encode("latin-1"))
        self.handshaked = True
        return True

    # ---------- обычный HTTP: раздача файлов игры с этого же порта ----------
    def _serve_http(self, head_bytes):
        """Не WebSocket-запрос — раздаём файлы игры (тот же порт)."""
        try:
            lines = head_bytes.decode("latin-1").split("\r\n")
            method, path, _proto = lines[0].split(" ", 2)
        except Exception:
            self.transport.write(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n")
            self.transport.close()
            return
        if method.upper() not in ("GET", "HEAD"):
            self.transport.write(b"HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\n\r\n")
            self.transport.close()
            return
        rel = unquote(path.split("?", 1)[0].split("#", 1)[0])
        if rel in ("/", ""):
            rel = "/index.html"
        full = os.path.normpath(os.path.join(ROOT, rel.lstrip("/")))
        data, ctype = None, "text/html; charset=utf-8"
        try:
            if os.path.isfile(full) and full.startswith(ROOT):
                ext = os.path.splitext(full)[1].lower()
                ctype = MIME.get(ext, "application/octet-stream")
                with open(full, "rb") as fh:
                    data = fh.read()
            elif os.path.isdir(full) and os.path.isfile(os.path.join(full, "index.html")):
                with open(os.path.join(full, "index.html"), "rb") as fh:
                    data = fh.read()
        except Exception:
            data = None
        if data is None:
            body = "404 — здесь только лес и плоды ✦".encode("utf-8")
            self.transport.write(
                b"HTTP/1.1 404 Not Found\r\nContent-Type: text/plain; charset=utf-8\r\n"
                b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)
            self.transport.close()
            return
        self.transport.write(
            ("HTTP/1.1 200 OK\r\nContent-Type: %s\r\nContent-Length: %d\r\n"
             "Cache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\n"
             "Connection: close\r\n\r\n" % (ctype, len(data)).encode("latin-1")) + data)
        self.transport.close()

    # ---------- данные ----------
    def data_received(self, data):
        if getattr(self, "http_only", False):
            return                              # соединение уже закрывается после ответа
        self.buf += data
        if not self.handshaked:
            res = self._try_handshake()
            if res is not True:      # None — ждать ещё; False — HTTP уже обработан
                return
        while self.handshaked and not self.closed:
            parsed = self._parse_frame()
            if parsed is None:
                break
            op, payload = parsed
            if op == OP_TEXT:
                if payload:
                    asyncio.ensure_future(self._on_message(payload))
            elif op == OP_PING:
                self._send_raw(encode_frame(payload, OP_PONG))
            elif op == OP_CLOSE:
                self.close()

    def _parse_frame(self):
        buf = self.buf
        if len(buf) < 2:
            return None
        b0, b1 = buf[0], buf[1]
        op = b0 & 0x0F
        masked = b1 & 0x80
        ln = b1 & 0x7F
        off = 2
        if ln == 126:
            if len(buf) < off + 2:
                return None
            ln = struct.unpack("!H", buf[off:off + 2])[0]; off += 2
        elif ln == 127:
            if len(buf) < off + 8:
                return None
            ln = struct.unpack("!Q", buf[off:off + 8])[0]; off += 8
        mask = b""
        if masked:
            if len(buf) < off + 4:
                return None
            mask = buf[off:off + 4]; off += 4
        if len(buf) < off + ln:
            return None
        payload = bytearray(buf[off:off + ln])
        if masked:
            for i in range(ln):
                payload[i] ^= mask[i % 4]
        self.buf = buf[off + ln:]
        return (op, payload.decode("utf-8", "replace"))

    async def _on_message(self, text):
        if self.closed:
            return
        try:
            msg = json.loads(text)
        except json.JSONDecodeError:
            return
        if not isinstance(msg, dict):
            return
        reply = await GAME.handle(self, msg)
        if reply:
            self.send(reply)

    # ---------- отправка ----------
    def _send_raw(self, chunk: bytes):
        if self.transport and not self.closed:
            try:
                self.transport.write(chunk)
            except Exception:
                self.closed = True

    def send(self, obj):
        self._send_raw(encode_frame(json.dumps(obj, ensure_ascii=False, separators=(",", ":"))))

    def close(self):
        if not self.closed:
            self._send_raw(encode_frame(b"", OP_CLOSE))
            self.closed = True
            if self.transport:
                self.transport.close()


async def broadcaster():
    """Раз в ~100 мс рассылает каждому игроку снимок состояния."""
    await asyncio.sleep(0.2)
    while True:
        t0 = time.monotonic()
        dead = []
        for ws in list(GAME.players.keys()):
            if ws.closed:
                dead.append(ws)
                continue
            after = GAME.players[ws].get("evt_seq", 0)
            snap = GAME.snapshot(after_seq=after)
            if snap["evts"]:
                # сдвигаем метку клиента — эти события он уже получил
                GAME.players[ws]["evt_seq"] = max(e[1]["seq"] for e in snap["evts"])
            ws._send_raw(encode_frame(json.dumps(snap, ensure_ascii=False, separators=(",", ":"))))
        for ws in dead:
            GAME.players.pop(ws, None)
        # авто-возврат духа после «смерти»
        if GAME.spirit_state == "die" and GAME.spirit_respawn_at and time.monotonic() > GAME.spirit_respawn_at:
            GAME.spirit_state = "lurk"
        await asyncio.sleep(max(0.0, 0.1 - (time.monotonic() - t0)))


# ============================ ТОЧКА ВХОДА =================================
def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def main():
    ap = argparse.ArgumentParser(
        description="Сетевой сервер FORBIDDEN FRUIT: игра + синхронизация на одном порту")
    ap.add_argument("port", nargs="?", type=int, default=None,
                    help="порт (по умолчанию 8000). Можно также: python3 server.py --port 9000")
    ap.add_argument("--host", default="0.0.0.0", help="адрес (по умолчанию все интерфейсы)")
    ap.add_argument("--port", dest="port_opt", type=int, default=None,
                    help="то же, что позиционный аргумент")
    args = ap.parse_args()
    port = args.port if args.port is not None else (args.port_opt or PORT_DEFAULT)

    async def amain():
        loop = asyncio.get_running_loop()
        ws_srv = await loop.create_server(lambda: WSProtocol(loop), args.host, port)
        print("=" * 62)
        print("  FORBIDDEN FRUIT — сервер запущен ✦ (игра и сеть на одном порту)")
        print("")
        print(f"  Игроки открывают в браузере:   http://{get_lan_ip()}:{port}")
        print(f"  На этом компьютере:           http://localhost:{port}")
        print("")
        print("  Друзья в локальной сети заходят по ссылке выше и жмут")
        print("  «🌐 Сетевая игра» — адрес сервера подставится сам.")
        print("  Ctrl+C — остановить сервер.")
        print("=" * 62)
        try:
            import webbrowser
            webbrowser.open(f"http://localhost:{port}")
        except Exception:
            pass
        broad = asyncio.ensure_future(broadcaster())
        try:
            await asyncio.Event().wait()   # вечный цикл событий
        finally:
            broad.cancel()
            ws_srv.close()

    try:
        asyncio.run(amain())
    except KeyboardInterrupt:
        pass
    finally:
        print("\nСервер остановлен.")


if __name__ == "__main__":
    main()
