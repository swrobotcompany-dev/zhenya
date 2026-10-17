#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Интеграционный тест сетевого сервера Forbidden Fruit.

Требует запущенный `python3 server.py` на localhost:8000.
Проверяет: раздачу файлов по HTTP, WebSocket-handshake, join/hello,
одинаковые плоды у всех, передачу позиций, доставку событий collect
второму клиенту (фикс по seq), открытие портала и newworld.
"""
import base64
import hashlib
import json
import os
import socket
import struct
import sys

HOST = "127.0.0.1"
PORT = int(os.environ.get("FF_PORT", "8000"))
GUID = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def http_get(path):
    s = socket.create_connection((HOST, PORT), timeout=5)
    s.sendall(f"GET {path} HTTP/1.1\r\nHost: {HOST}\r\nConnection: close\r\n\r\n".encode())
    data = b""
    while True:
        chunk = s.recv(65536)
        if not chunk:
            break
        data += chunk
    s.close()
    head, _, body = data.partition(b"\r\n\r\n")
    status = head.split(b"\r\n", 1)[0].decode()
    return status, body


class WSClient:
    def __init__(self, name, team="red", world="meadow"):
        self.sock = socket.create_connection((HOST, PORT), timeout=5)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (f"GET /ws HTTP/1.1\r\nHost: {HOST}\r\nUpgrade: websocket\r\n"
               f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n"
               f"Sec-WebSocket-Version: 13\r\n\r\n")
        self.sock.sendall(req.encode())
        resp = self._read_until(b"\r\n\r\n")
        assert b"101 Switching Protocols" in resp, "handshake failed: " + resp.decode(errors="replace")
        expect = base64.b64encode(hashlib.sha1(key.encode() + GUID).digest())
        assert expect in resp, "bad Sec-WebSocket-Accept"
        self.buf = b""
        self.send({"type": "join", "name": name, "team": team, "world": world})

    def _read_until(self, delim):
        data = b""
        while delim not in data:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError("closed")
            data += chunk
        return data

    def send(self, obj):
        payload = json.dumps(obj).encode()
        mask = os.urandom(4)
        n = len(payload)
        header = bytearray([0x81])
        if n < 126:
            header.append(0x80 | n)
        elif n < 65536:
            header.append(0x80 | 126)
            header += struct.pack("!H", n)
        else:
            header.append(0x80 | 127)
            header += struct.pack("!Q", n)
        header += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(bytes(header) + masked)

    def read_frame(self):
        h = self._read_exact(2)
        ln = h[1] & 0x7F
        if ln == 126:
            ln = struct.unpack("!H", self._read_exact(2))[0]
        elif ln == 127:
            ln = struct.unpack("!Q", self._read_exact(8))[0]
        data = self._read_exact(ln)
        return json.loads(data.decode())

    def _read_exact(self, n):
        buf = b""
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise ConnectionError("closed")
            buf += chunk
        return buf

    def wait_state(self, pred, timeout=5.0, note=""):
        import time as _t
        end = _t.time() + timeout
        last = None
        while _t.time() < end:
            self.sock.settimeout(max(0.1, end - _t.time()))
            try:
                m = self.read_frame()
            except socket.timeout:
                continue
            if m.get("type") in ("hello", "state"):
                last = m["state"] if m["type"] == "hello" else m
                if pred(last):
                    return last
        raise AssertionError(f"timeout waiting state ({note}); last={json.dumps(last, ensure_ascii=False)[:300]}")


PASSED = []


def check(cond, label):
    assert cond, "FAIL: " + label
    PASSED.append(label)
    print("  ✓", label)


def main():
    print("== HTTP-раздача с того же порта ==")
    st, body = http_get("/")
    check(st.startswith("200"), "GET / -> 200")
    check(b"FORBIDDEN FRUIT" in body or b"Forbidden Fruit" in body, "index.html содержит игру")
    st2, _ = http_get("/js/net/net-client.js")
    check(st2.startswith("200"), "GET net-client.js -> 200")
    st3, _ = http_get("/css/style.css")
    check(st3.startswith("200"), "GET style.css -> 200")
    st4, _ = http_get("/nope.xyz")
    check(st4.startswith("404"), "несуществующий файл -> 404")

    print("== WebSocket: два игрока ==")
    a = WSClient("Алиса", "red")
    sa = a.wait_state(lambda s: True, note="hello A")
    me_a = [p for p in sa["players"] if p["name"] == "Алиса"]
    check(len(me_a) == 1, "Алиса зарегистрирована на сервере")

    b = WSClient("Борис", "sand")
    sb = b.wait_state(lambda s: any(p["name"] == "Борис" for p in s["players"]), note="hello B")
    fa = [f["id"] for f in sb["fruits"]]
    sa2 = a.wait_state(lambda s: any(p["name"] == "Борис" for p in s["players"]), note="Борис виден Алисе")
    check([f["id"] for f in sa2["fruits"]] == fa and
          all(abs(x["x"] - y["x"]) < 1e-9 for x, y in zip(sa2["fruits"], sb["fruits"])),
          "плоды одинаковы у обоих клиентов")
    check(any(p["name"] == "Алиса" for p in sb["players"]) and
          any(p["name"] == "Борис" for p in sa2["players"]), "оба игрока видят друг друга")

    print("== Позиции ==")
    a.send({"type": "pos", "x": 3.5, "y": 0, "z": -2.25, "ry": 1.0})
    b.wait_state(lambda s: any(p["name"] == "Алиса" and abs(p["x"] - 3.5) < 0.01
                               and abs(p["z"] + 2.25) < 0.01 for p in s["players"]),
                 note="позиция Алисы дошла до Бориса")
    check(True, "позиция транслируется второму игроку")

    print("== События collect доставляются второму клиенту (seq) ==")
    # первый плод — событие должно прийти Борису в evts обязательно
    a.send({"type": "collect", "fruit": fa[0]})
    stb = b.wait_state(lambda s: s["collected"] >= 1 and any(
        e.get("kind") == "collect" and "seq" in e for e in s.get("evts", [])),
        note="evts collect со seq дошли до Бориса")
    check(stb["collected"] == 1, "счётчик собранных = 1")
    check(any(e.get("kind") == "collect" for e in stb["evts"]),
          "событие «сорвал плод» доставлено второму игроку")

    print("== Портал ==")
    for fid in fa[1:]:
        a.send({"type": "collect", "fruit": fid})
    stb4 = b.wait_state(lambda s: s["portal"] is True and s["collected"] == 7, note="портал открыт")
    check(stb4["portal"], "портал открылся у обоих после 7/7")

    print("== newworld ==")
    b.send({"type": "newworld", "world": "mistfen"})
    sta = a.wait_state(lambda s: s["world"] == "mistfen" and s["collected"] == 0, note="мир перезапущен")
    check(sta["world"] == "mistfen" and sta["collected"] == 0, "общий рестарт мира применён ко всем")

    a.sock.close(); b.sock.close()
    print()
    print(f"ВСЕ СЕТЕВЫЕ ТЕСТЫ ПРОЙДЕНЫ OK ({len(PASSED)} проверок)")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print("\n✗", e)
        sys.exit(1)
