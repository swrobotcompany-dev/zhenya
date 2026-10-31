#!/usr/bin/env python3
"""FORBIDDEN FRUIT — простой HTTP-сервер для игры на localhost и в локальной сети.

По умолчанию принимает подключения на всех IPv4-интерфейсах (0.0.0.0).
WebSocket, лобби и Python-зависимости не требуются.
"""
import argparse
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent


def local_addresses():
    """Найти подходящие локальные IPv4-адреса для ссылки друзьям."""
    addresses = set()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            # Не отправляет UDP-пакетов, лишь определяет исходящий сетевой интерфейс.
            sock.connect(("192.0.2.1", 80))
            addresses.add(sock.getsockname()[0])
    except OSError:
        pass
    try:
        addresses.update(socket.gethostbyname_ex(socket.gethostname())[2])
    except OSError:
        pass
    return sorted(ip for ip in addresses
                  if ip and not ip.startswith("127.") and ip != "0.0.0.0")


class GameHandler(SimpleHTTPRequestHandler):
    """Показываем исходную игру, не открывая другие файлы проекта."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _allowed(self):
        return urlsplit(self.path).path in ("/", "/index.html")

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

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


def main():
    parser = argparse.ArgumentParser(description="FORBIDDEN FRUIT — сервер для игры в браузере")
    parser.add_argument("--port", type=int, default=8000, help="порт HTTP (по умолчанию 8000)")
    parser.add_argument("--host", default="0.0.0.0",
                        help="адрес прослушивания: 0.0.0.0 для локальной сети; 127.0.0.1 только для себя")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Порт должен быть от 1 до 65535")

    try:
        with ThreadingHTTPServer((args.host, args.port), GameHandler) as httpd:
            print("FORBIDDEN FRUIT — сервер запущен", flush=True)
            print(f"На этом ПК: http://localhost:{args.port}")
            if args.host == "0.0.0.0":
                ips = local_addresses()
                for ip in ips:
                    print(f"На другом ПК в той же сети: http://{ip}:{args.port}")
                if not ips:
                    print("Локальный IP: посмотрите ipconfig (Windows) или ip -4 addr (Linux).")
                print("Если удалённый ПК не подключается, проверьте брандмауэр и адрес IPv4.")
            elif args.host not in ("localhost", "127.0.0.1"):
                print(f"Адрес сервера: http://{args.host}:{args.port}")
            print("Ctrl+C — остановить сервер.", flush=True)
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nСервер остановлен.")
    except OSError as exc:
        parser.exit(1, f"Не удалось запустить сервер: {exc}\n")


if __name__ == "__main__":
    main()
