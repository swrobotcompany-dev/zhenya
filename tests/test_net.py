#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Интеграционный тест сетевого сервера FORBIDDEN FRUIT (клиент на чистом сокете)."""
import base64, hashlib, json, os, socket, struct, sys, time

HOST, PORT = "127.0.0.1", 8765
GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

def frame(payload: str) -> bytes:
    data = payload.encode()
    mask = os.urandom(4)
    ln = len(data)
    if ln < 126: head = struct.pack("!BB", 0x81, 0x80 | ln)
    elif ln < (1 << 16): head = struct.pack("!BBH", 0x81, 0x80 | 126, ln)
    else: head = struct.pack("!BBQ", 0x81, 0x80 | 127, ln)
    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
    return head + mask + masked

class Client:
    def __init__(self, name, team):
        self.s = socket.create_connection((HOST, PORT), timeout=5)
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall(("GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\n"
                        "Connection: Upgrade\r\nSec-WebSocket-Key: %s\r\n"
                        "Sec-WebSocket-Version: 13\r\n\r\n" % key).encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            resp += self.s.recv(4096)
        assert b"101" in resp.split(b"\r\n")[0], resp
        expect = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        assert expect.encode() in resp, "bad accept header"
        self.buf = b""
        self.id = None
        self.world = None
        self.snaps = []
        self.hello = None
        self.send({"t": "join", "name": name, "team": team})

    def send(self, obj):
        self.s.sendall(frame(json.dumps(obj)))

    def pump(self, seconds):
        end = time.time() + seconds
        while time.time() < end:
            self.s.settimeout(max(0.1, end - time.time()))
            try:
                self.buf += self.s.recv(65536)
            except socket.timeout:
                continue
            while True:
                if len(self.buf) < 2: break
                ln = self.buf[1] & 0x7F; off = 2
                if ln == 126:
                    if len(self.buf) < 4: break
                    ln = struct.unpack("!H", self.buf[2:4])[0]; off = 4
                elif ln == 127:
                    if len(self.buf) < 10: break
                    ln = struct.unpack("!Q", self.buf[2:10])[0]; off = 10
                if len(self.buf) < off + ln: break
                payload = bytes(self.buf[off:off + ln]); self.buf = self.buf[off + ln:]
                m = json.loads(payload.decode("utf-8", "replace"))
                if m.get("t") == "hello":
                    self.hello = m; self.id = m["id"]; self.world = m["world"]
                elif m.get("t") == "state":
                    self.snaps.append(m)

    def last(self):
        return self.snaps[-1] if self.snaps else None

    def close(self):
        try: self.s.close()
        except Exception: pass

def check(cond, msg):
    print(("PASS: " if cond else "FAIL: ") + msg)
    if not cond: sys.exit(1)

a = Client("Аня", 0)
a.pump(0.5)
check(a.hello is not None, "клиент А получил hello")
check(len(a.hello["snapshot"]["fruits"]) == 7, "в hello 7 плодов")
fa = a.last()
check(fa is not None and fa["collected"] == 0, "первый снапшот: собрано 0")

b = Client("Боря", 1)
b.pump(0.5)
check(b.id != a.id, "ид players уникальны (%s vs %s)" % (a.id, b.id))
check([f[:2] for f in a.last()["fruits"]] == [f[:2] for f in b.last()["fruits"]],
      "плоды у обоих игроков в одних местах")

for _ in range(5):
    a.send({"t": "pos", "x": 5.5, "z": -3.25, "yaw": 1.5, "sprint": True}); a.pump(0.08)
a.pump(0.3); b.pump(0.3)
pb = next(p for p in b.last()["players"] if p["id"] == a.id)
check(abs(pb["x"] - 5.5) < 0.01 and abs(pb["z"] + 3.25) < 0.01,
      "позиция Ани видна Боре (%.2f, %.2f)" % (pb["x"], pb["z"]))

for i in range(7):
    a.send({"t": "collect", "i": i}); a.pump(0.12)
a.pump(0.4); b.pump(0.4)
sa, sb = a.last(), b.last()
check(sa["collected"] == 7 and sb["collected"] == 7, "счёт 7/7 у обоих")
check(all(f[2] == 0 for f in sb["fruits"]), "плоды «сорваны» у всех")
check(sb["portal"] is True, "портал открыт для всех")
check(any(e[1]["kind"] == "collect" and e[1]["by"] == a.id for e in sb["evts"]),
      "событие collect с id автора дошло до Бори")

for _ in range(3):
    b.send({"t": "hit"}); b.pump(0.15)
b.pump(0.4); a.pump(0.2)
pba = next(p for p in a.last()["players"] if p["id"] == b.id)
check(pba["hearts"] == 0 and pba["alive"] is False, "Боря выбыл (0 сердец), видит Аня")
check(a.last()["spirit"]["state"] in ("die", "lurk"), "дух перешёл в die/lurk после удара")

a.send({"t": "portal"}); a.pump(0.4); b.pump(0.3)
check(a.last()["state"] == "over" or any(e[1].get("kind") == "end" for e in a.last()["evts"]),
      "мир объявлен пройденным")

a.send({"t": "restart", "world": "magic"}); a.pump(0.4); b.pump(0.3)
check(a.last()["world"] == "magic" and b.last()["world"] == "magic", "рестарт применён у всех")
check(a.last()["collected"] == 0, "после рестарта счёт обнулился")

b.close(); a.pump(0.6)
ids = [p["id"] for p in a.last()["players"]]
check(b.id not in ids, "отключившийся игрок убран из списка")

a.close()
print("\nВСЕ СЕТЕВЫЕ ТЕСТЫ ПРОЙДЕНЫ OK")
