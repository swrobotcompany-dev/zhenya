#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FORBIDDEN FRUIT — сервер для игры по локальной сети (без внешних зависимостей).

WebSocket-порт (по умолчанию 8765) — синхронизирует игроков
(общие плоды, портал, дух тумана, позиции лисят).

Запуск:
  python3 server.py                      # только WebSocket-сервер
  python3 server.py --ws-port 8765       # с другим портом
  python3 serve_game.py                  # вторая программа: раздача игры по HTTP (порт 8000)

Игроки открывают в браузере: http://IP-сервера:8000
"""
import argparse
import asyncio
import base64
import hashlib
import json
import os
import socket
import struct
import sys
import threading
import time
from collections import deque

ROOT = os.path.dirname(os.path.abspath(__file__))
WS_PORT_DEFAULT = 8765
GUID_MAGIC = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
OP_TEXT, OP_BIN, OP_CLOSE, OP_PING, OP_PONG = 0x1, 0x2, 0x8, 0x9, 0xA


# ============================ СОСТОЯНИЕ ИГРЫ ==============================
class GameState:
    """Единое состояние мира для всех подключённых игроков."""

    def __init__(self):
        self.lock = asyncio.Lock()
        self.players = {}          # ws -> {"id":..,"name":..,"team":..,...}
        self.next_id = 1
        self.seq = 0
        self.events = deque(maxlen=64)   # [(server_time, evt), ...]
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
                "evt_mark": time.time(),   # клиент увидит события, случившиеся после входа
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

    # ----- снапшот для рассылки -----
    def snapshot(self, mark=None):
        """mark=None — «сырые» новые события (для hello);
        иначе — события после метки клиента (выдаём один раз и не теряем)."""
        players = []
        for p in self.players.values():
            players.append({
                "id": p["id"], "name": p["name"], "team": p["team"],
                "x": round(p["x"], 2), "z": round(p["z"], 2), "yaw": round(p["yaw"], 2),
                "sprint": p["sprint"], "hearts": p["hearts"], "alive": p["alive"],
            })
        if mark is None:                       # режим hello
            new_evts = [e for e in self.events if e[0] > self.snapshot_mark]
            for ts, e in new_evts:
                self.snapshot_mark = max(self.snapshot_mark, ts)
        else:                                  # режим клиента: выдаём всё после его метки
            new_evts = [e for e in self.events if e[0] > mark]
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
        self.snapshot_mark = 0.0


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
        self.closed = False
        self.is_server_side = True

    def connection_made(self, transport):
        self.transport = transport

    def connection_lost(self, exc):
        self.closed = True
        asyncio.ensure_future(GAME.leave(self))

    # ---------- handshake ----------
    def _try_handshake(self):
        if b"\r\n\r\n" not in self.buf:
            return False
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
            if not key:
                raise ValueError("no key")
        except Exception:
            self.transport.write(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n")
            self.transport.close()
            return True  # буфер уже «потреблён», дальше не трогаем
        accept = ws_accept(key.encode("latin-1"))
        self.transport.write(
            ("HTTP/1.1 101 Switching Protocols\r\n"
             "Upgrade: websocket\r\nConnection: Upgrade\r\n"
             "Sec-WebSocket-Accept: %s\r\n\r\n" % accept).encode("latin-1"))
        self.handshaked = True
        return True

    # ---------- данные ----------
    def data_received(self, data):
        self.buf += data
        if not self.handshaked:
            if not self._try_handshake():
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
            mark = GAME.players[ws].get("evt_mark", 0.0)
            snap = GAME.snapshot(mark=mark)
            if snap["evts"]:
                # сдвигаем метку клиента — эти события он уже получил
                GAME.players[ws]["evt_mark"] = max(e[0] for e in _events_after(mark))
            ws._send_raw(encode_frame(json.dumps(snap, ensure_ascii=False, separators=(",", ":"))))
        for ws in dead:
            GAME.players.pop(ws, None)
        # авто-возврат духа после «смерти»
        if GAME.spirit_state == "die" and GAME.spirit_respawn_at and time.monotonic() > GAME.spirit_respawn_at:
            GAME.spirit_state = "lurk"
        await asyncio.sleep(max(0.0, 0.1 - (time.monotonic() - t0)))


def _events_after(mark):
    return [e for e in GAME.events if e[0] > mark]


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
    ap = argparse.ArgumentParser(description="Сетевой сервер FORBIDDEN FRUIT (WebSocket)")
    ap.add_argument("--host", default="0.0.0.0", help="адрес (по умолчанию все интерфейсы)")
    ap.add_argument("--ws-port", type=int, default=WS_PORT_DEFAULT, help="WebSocket-порт (по умолчанию 8765)")
    args = ap.parse_args()

    async def amain():
        loop = asyncio.get_running_loop()
        ws_srv = await loop.create_server(lambda: WSProtocol(loop), args.host, args.ws_port)
        print("=" * 62)
        print("  FORBIDDEN FRUIT — сетевой сервер запущен ✦")
        print(f"  Синхронизация игроков:  ws://{get_lan_ip()}:{args.ws_port}")
        print("")
        print("  Не забудьте также запустить раздачу игры:")
        print(f"     python3 serve_game.py   (http://IP-сервера:8000)")
        print("  Игроки в локальной сети открывают адрес выше,")
        print("  выбирают «Сетевую игру» и вводят IP этого компьютера.")
        print("  Ctrl+C — остановить сервер.")
        print("=" * 62)
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
