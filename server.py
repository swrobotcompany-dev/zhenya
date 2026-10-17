#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FORBIDDEN FRUIT — единый сетевой сервер (чистый Python 3, без зависимостей).

Один процесс на одном порту (по умолчанию 8000):
  * HTTP  — раздаёт файлы игры в браузеры игроков;
  * WebSocket — синхронизирует общий мир (плоды, портал, дух, игроки).

Запуск:            python3 server.py [порт]
Игроки открывают:  http://IP-этой-машины:порт
"""

import asyncio
import base64
import hashlib
import json
import math
import mimetypes
import os
import random
import socket
import struct
import sys
import time
from collections import deque
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
WS_GUID = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
DEFAULT_PORT = 8000
TICK = 0.1  # снапшоты состояния ~10 Гц

FRUIT_COUNT = 7
MAX_HEARTS = 3
SPIRIT_DMG_CD = 1.2
WORLD_SIZE = 40.0

TEAM_COLORS = {
    "red":    {"name": "Рыжий",        "hex": "#e8763a"},
    "sand":   {"name": "Песочный",     "hex": "#e8c07a"},
    "silver": {"name": "Серебристый",  "hex": "#b9c4cf"},
    "coal":   {"name": "Угольный",     "hex": "#4a4f5a"},
}

WORLDS = ["meadow", "hollow", "mistfen"]


def local_ip():
    """Лучший «сетевой» IP машины для ссылки игрокам."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


class Player:
    def __init__(self, pid, ws):
        self.id = pid
        self.ws = ws
        self.name = "лисёнок"
        self.team = "red"
        self.world = WORLDS[0]
        self.x, self.y, self.z = 0.0, 0.0, 0.0
        self.ry = 0.0
        self.hearts = MAX_HEARTS
        self.alive = True
        self.last_seq = 0          # сколько событий клиент уже видел
        self.hit_cd_until = 0.0    # кулдаган урона на сервере
        self.last_seen = time.time()


class GameServer:
    def __init__(self):
        self.players = {}          # pid -> Player
        self.writer_ws = {}        # writer -> ws-player (для broadcast)
        self.fruits = []           # [{"id",x,y,z,"taken","by"}]
        self.collected = 0
        self.portal_open = False
        self.winner = None
        self.spirit = {"x": 0.0, "y": 0.0, "z": -10.0, "respawn_at": 0.0}
        self.world = WORLDS[0]
        self.events = deque(maxlen=64)  # (seq, evt)
        self.seq = 0
        self._pid = 0

    # ---------- события ----------
    def ev(self, kind, **kw):
        self.seq += 1
        e = {"seq": self.seq, "kind": kind, "t": time.time()}
        e.update(kw)
        self.events.append((self.seq, e))
        return e

    def events_after(self, last):
        return [e for (s, e) in self.events if s > last]

    # ---------- мир ----------
    def new_world(self, world=None):
        if world in WORLDS:
            self.world = world
        rng = random.Random(int(time.time() * 1000) & 0xFFFFFFFF)
        self.fruits = []
        for i in range(FRUIT_COUNT):
            ang = rng.uniform(0, 6.283)
            rad = rng.uniform(6.0, WORLD_SIZE * 0.45)
            self.fruits.append({
                "id": i,
                "x": round(math.cos(ang) * rad, 2),
                "y": 0.0,
                "z": round(math.sin(ang) * rad, 2),
                "taken": False, "by": None,
            })
        self.collected = 0
        self.portal_open = False
        self.winner = None
        self.spirit = {"x": 0.0, "y": 0.0, "z": -10.0, "respawn_at": 0.0}
        for p in self.players.values():
            p.x = p.y = p.z = 0.0
            p.hearts = MAX_HEARTS
            p.alive = True
            p.last_seq = 0
        self.ev("world", world=self.world)
        self.ev("join_hint", text="Новая прогулка началась ✦")

    # ---------- снимок ----------
    def snapshot(self, after_seq=0):
        return {
            "type": "state",
            "world": self.world,
            "fruits": self.fruits,
            "collected": self.collected,
            "total": FRUIT_COUNT,
            "portal": self.portal_open,
            "winner": self.winner,
            "spirit": self.spirit,
            "players": [
                {"id": p.id, "name": p.name, "team": p.team,
                 "x": round(p.x, 3), "y": round(p.y, 3), "z": round(p.z, 3),
                 "ry": round(p.ry, 3), "hearts": p.hearts, "alive": p.alive}
                for p in self.players.values()
            ],
            "evts": self.events_after(after_seq),
        }

    # ---------- обработка сообщений ----------
    def handle(self, p, msg):
        t = msg.get("type")
        now = time.time()
        p.last_seen = now
        if t == "join":
            name = str(msg.get("name", ""))[:16].strip() or "лисёнок"
            team = msg.get("team") if msg.get("team") in TEAM_COLORS else "red"
            p.name, p.team = name, team
            w = msg.get("world")
            if w in WORLDS and not self.players_any_online_before():
                self.world = w
            p.world = self.world
            self.ev("presence", text=f"{p.name} присоединяется к прогулке 🦊")
            return {"type": "hello", "id": p.id, "state": self.snapshot(0)}
        if t == "pos":
            try:
                p.x = float(msg.get("x", p.x))
                p.y = float(msg.get("y", p.y))
                p.z = float(msg.get("z", p.z))
                p.ry = float(msg.get("ry", p.ry))
            except (TypeError, ValueError):
                pass
            return None
        if t == "collect":
            fid = msg.get("fruit")
            for f in self.fruits:
                if f["id"] == fid and not f["taken"]:
                    f["taken"] = True
                    f["by"] = p.id
                    self.collected += 1
                    self.ev("collect", by=p.name, fruit=fid,
                            collected=self.collected, total=FRUIT_COUNT,
                            text=f"{p.name} сорвал запретный плод ✦ ({self.collected}/{FRUIT_COUNT})")
                    if self.collected >= FRUIT_COUNT:
                        self.portal_open = True
                        self.ev("portal", text="Все плоды собраны — портал открылся! 🌀")
                    return None
            return None
        if t == "hit":
            if now < p.hit_cd_until or not p.alive:
                return None
            p.hit_cd_until = now + SPIRIT_DMG_CD
            p.hearts = max(0, p.hearts - 1)
            self.ev("hit", who=p.name, hearts=p.hearts,
                    text=(f"{p.name} получил удар от духа тумана 💢"
                          if p.hearts else f"{p.name} выбыл до конца прогулки…"))
            if p.hearts == 0:
                p.alive = False
            return None
        if t == "portal":
            if self.portal_open and p.alive and not self.winner:
                self.winner = p.id
                self.ev("win", by=p.name,
                        text=f"{p.name} довёл команду до портала — победа! 🏆")
            return None
        if t == "newworld" or t == "restart":
            self.new_world(msg.get("world"))
            return None
        return None

    def players_any_online_before(self):
        return len(self.players) > 1  # текущий игрок уже добавлен


# ================== WebSocket (RFC6455, минимальная реализация) ==================

async def read_exact(stream, n):
    buf = b""
    while len(buf) < n:
        chunk = await stream.read(n - len(buf))
        if not chunk:
            raise ConnectionError("closed")
        buf += chunk
    return buf


async def ws_read_frame(stream):
    """Возвращает (opcode, payload) или None при закрытии."""
    try:
        h = await read_exact(stream, 2)
    except ConnectionError:
        return None
    b1, b2 = h[0], h[1]
    opcode = b1 & 0x0F
    masked = b2 & 0x80
    ln = b2 & 0x7F
    if ln == 126:
        ln = struct.unpack("!H", await read_exact(stream, 2))[0]
    elif ln == 127:
        ln = struct.unpack("!Q", await read_exact(stream, 8))[0]
    mask = await read_exact(stream, 4) if masked else None
    data = await read_exact(stream, ln) if ln else b""
    if mask:
        data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
    return opcode, data


def ws_encode_frame(payload_bytes, opcode=0x1):
    out = bytearray([0x80 | opcode])
    n = len(payload_bytes)
    if n < 126:
        out.append(n)
    elif n < 65536:
        out.append(126)
        out += struct.pack("!H", n)
    else:
        out.append(127)
        out += struct.pack("!Q", n)
    out += payload_bytes
    return bytes(out)


async def handle_connection(reader, writer, srv: GameServer):
    peer = writer.get_extra_info("peername")
    try:
        req = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), timeout=10)
    except (asyncio.LimitOverrunError, ValueError, asyncio.TimeoutError, ConnectionError):
        writer.close()
        return
    lines = req.decode("latin-1", "replace").split("\r\n")
    try:
        method, path, _ = lines[0].split(" ", 2)
    except ValueError:
        writer.close()
        return
    hdrs = {}
    for line in lines[1:]:
        if ":" in line:
            k, v = line.split(":", 1)
            hdrs[k.strip().lower()] = v.strip()

    if hdrs.get("upgrade", "").lower() == "websocket":
        await handle_websocket(reader, writer, srv, path, hdrs, peer)
    else:
        serve_http(writer, path)
        try:
            await writer.drain()
        except Exception:
            pass
        writer.close()


def serve_http(writer, path):
    try:
        p = urlparse(path).path
        if p in ("/", ""):
            p = "/index.html"
        fp = os.path.normpath(os.path.join(ROOT, p.lstrip("/")))
        if not fp.startswith(ROOT) or not os.path.isfile(fp):
            writer.write(_http_err(404, "Not Found"))
            return
        with open(fp, "rb") as f:
            data = f.read()
        ext = os.path.splitext(fp)[1]
        ctype = mimetypes.guess_type(fp)[0] or {
            ".js": "text/javascript", ".css": "text/css",
            ".html": "text/html", ".json": "application/json",
            ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
        }.get(ext, "application/octet-stream")
        head = ("HTTP/1.1 200 OK\r\n"
                "Content-Type: %s; charset=utf-8\r\n"
                "Content-Length: %d\r\n"
                "Cache-Control: no-store\r\n"
                "Access-Control-Allow-Origin: *\r\n"
                "Connection: close\r\n\r\n") % (ctype, len(data))
        writer.write(head.encode("latin-1") + data)
    except Exception:
        writer.write(_http_err(500, "Internal Server Error"))


def _http_err(code, text):
    body = ("%d %s" % (code, text)).encode()
    return (("HTTP/1.1 %d %s\r\nContent-Type: text/plain; charset=utf-8\r\n"
             "Content-Length: %d\r\nConnection: close\r\n\r\n")
            % (code, text, len(body))).encode() + body


async def handle_websocket(reader, writer, srv: GameServer, path, hdrs, peer):
    key = hdrs.get("sec-websocket-key", "")
    if not key:
        writer.write(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n")
        writer.close()
        return
    accept = base64.b64encode(hashlib.sha1(key.encode() + WS_GUID).digest()).decode()
    writer.write(("HTTP/1.1 101 Switching Protocols\r\n"
                  "Upgrade: websocket\r\nConnection: Upgrade\r\n"
                  "Sec-WebSocket-Accept: %s\r\n\r\n" % accept).encode("latin-1"))
    await writer.drain()

    srv._pid += 1
    pid = "p%d" % srv._pid
    p = Player(pid, writer)
    srv.players[pid] = p
    qs = parse_qs(urlparse(path).query)
    reply = srv.handle(p, {"type": "join",
                           "name": (qs.get("name") or [""])[0],
                           "team": (qs.get("team") or [""])[0],
                           "world": (qs.get("world") or [""])[0]})
    if reply:
        await ws_send(writer, reply)

    try:
        while True:
            got = await ws_read_frame(reader)
            if got is None:
                break
            opcode, payload = got
            if opcode == 0x8:
                break
            if opcode == 0x9:
                writer.write(ws_encode_frame(payload, 0xA))
                await writer.drain()
                continue
            if opcode in (0x1, 0x2):
                try:
                    msg = json.loads(payload.decode("utf-8", "replace"))
                except (ValueError, UnicodeDecodeError):
                    continue
                r = srv.handle(p, msg)
                if r:
                    await ws_send(writer, r)
    except (ConnectionError, asyncio.IncompleteReadError):
        pass
    finally:
        srv.players.pop(pid, None)
        srv.ev("leave", text=f"{p.name} ушёл из леса")
        writer.close()


async def ws_send(writer, obj):
    try:
        if writer.is_closing():
            return
        writer.write(ws_encode_frame(json.dumps(obj, ensure_ascii=False).encode()))
        await writer.drain()
    except Exception:
        pass


async def broadcaster(srv: GameServer):
    while True:
        await asyncio.sleep(TICK)
        now = time.time()
        # респирит
        if srv.spirit["respawn_at"] and now >= srv.spirit["respawn_at"]:
            srv.spirit["respawn_at"] = 0.0
            srv.spirit.update({"x": 0.0, "y": 0.0, "z": -10.0})
        targets = list(srv.players.values())
        for p in targets:
            snap = srv.snapshot(after_seq=p.last_seq)
            await ws_send(p.ws, snap)
            if snap["evts"]:
                p.last_seq = max(e["seq"] for e in snap["evts"])


async def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    srv = GameServer()
    srv.new_world(WORLDS[0])
    loop = asyncio.get_running_loop()
    server = await loop.create_server(
        lambda: _StreamHandler(srv), "0.0.0.0", port, reuse_address=True)
    ip = local_ip()
    print("FORBIDDEN FRUIT — сервер запущен ✦ (игра и сеть на одном порту)\n")
    print(f"Игроки открывают в браузере:   http://{ip}:{port}")
    print(f"На этом компьютере:            http://localhost:{port}\n")
    print("Ctrl+C — остановить сервер.")
    try:
        sys.stdout.flush()
    except Exception:
        pass
    asyncio.ensure_future(broadcaster(srv))
    async with server:
        await server.serve_forever()


class _StreamHandler(asyncio.Protocol):
    """Мост Protocol -> StreamReader/Writer для handle_connection."""
    def __init__(self, srv):
        self.srv = srv
        self.reader = asyncio.StreamReader()
        self._transport = None
        self._task = None

    def connection_made(self, transport):
        self._transport = transport
        writer = asyncio.StreamWriter(transport, self, self.reader, asyncio.get_running_loop())
        self._task = asyncio.ensure_future(handle_connection(self.reader, writer, self.srv))

    def data_received(self, data):
        self.reader.feed_data(data)

    def eof_received(self):
        self.reader.feed_eof()

    def connection_lost(self, exc):
        self.reader.feed_eof()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nСервер остановлен.")
