#!/usr/bin/env python3
"""FORBIDDEN FRUIT: локальный HTTP-сервер без внешних библиотек.

Слушает только 127.0.0.1. Никаких WebSocket и сетевого лобби.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

ROOT = Path(__file__).resolve().parent

class GameHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _allowed(self):
        return self.path.split("?", 1)[0].split("#", 1)[0] in ("/", "/index.html")

    def do_GET(self):
        if not self._allowed():
            self.send_error(404, "Not Found")
            return
        super().do_GET()

    def do_HEAD(self):
        if not self._allowed():
            self.send_error(404, "Not Found")
            return
        super().do_HEAD()

    def log_message(self, format, *args):
        print("[%s] %s" % (self.log_date_time_string(), format % args))


def main():
    parser = argparse.ArgumentParser(description="Запуск оригинальной Forbidden Fruit на localhost")
    parser.add_argument("--port", type=int, default=8000, help="локальный HTTP-порт (8000 по умолчанию)")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Порт должен быть в диапазоне 1..65535")
    with ThreadingHTTPServer(("127.0.0.1", args.port), GameHandler) as httpd:
        print(f"FORBIDDEN FRUIT запущена: http://localhost:{args.port}")
        print("Для выхода нажмите Ctrl+C. Сервер доступен только с этого компьютера.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nСервер остановлен.")


if __name__ == "__main__":
    main()
