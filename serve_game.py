#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Раздача файлов игры FORBIDDEN FRUIT по HTTP для локальной сети.

Запуск (из папки с игрой):
  python3 serve_game.py                 # порт 8000, все интерфейсы
  python3 serve_game.py --port 9000

Игроки открывают:  http://IP-этого-компьютера:8000

Рядом должен работать синхронизирующий сервер:  python3 server.py
"""
import argparse
import os
import socket
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))


class GameHTTPHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stdout.write("[http] %s — %s\n" % (self.address_string(), fmt % args))


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
    ap = argparse.ArgumentParser(description="HTTP-раздача игры FORBIDDEN FRUIT")
    ap.add_argument("--host", default="0.0.0.0", help="адрес (по умолчанию все интерфейсы)")
    ap.add_argument("--port", type=int, default=8000, help="HTTP-порт (по умолчанию 8000)")
    ap.add_argument("--dir", default=ROOT, help="папка с файлами игры")
    ap.add_argument("--no-browser", action="store_true", help="не открывать браузер автоматически")
    args = ap.parse_args()

    if not os.path.exists(os.path.join(args.dir, "index.html")):
        print("Ошибка: в папке %s нет index.html." % args.dir)
        sys.exit(1)

    handler = partial(GameHTTPHandler, directory=args.dir)
    httpd = ThreadingHTTPServer((args.host, args.port), handler)
    print("=" * 62)
    print("  FORBIDDEN FRUIT — раздача игры запущена ✦")
    print(f"  Играть в браузере:  http://{get_lan_ip()}:{args.port}")
    print(f"  На этом компьютере: http://localhost:{args.port}")
    print("  Для сетевой игры также нужен: python3 server.py")
    print("  Ctrl+C — остановить.")
    print("=" * 62)
    if not args.no_browser:
        try:
            import webbrowser
            webbrowser.open(f"http://localhost:{args.port}")
        except Exception:
            pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.shutdown()
        print("\nHTTP-сервер остановлен.")


if __name__ == "__main__":
    main()
