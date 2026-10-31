#!/usr/bin/env python3
"""FORBIDDEN FRUIT: лёгкий локальный HTTP-сервер (Python 3, без зависимостей).

Подключение: http://localhost:8000 или http://<локальный-IP-ПК>:8000.
HTML отдаётся с gzip, ETag/Last-Modified и кешируется в оперативной памяти
сервера между запросами. WebSocket и мультиплеер не нужны.
"""
import argparse
import gzip
import socket
from datetime import timezone
from email.utils import formatdate, parsedate_to_datetime
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
INDEX = ROOT / "index.html"


@lru_cache(maxsize=3)
def cached_index(mtime_ns, size):
    """Готовые несжатая и gzip-версии HTML; ключ меняется при изменении файла."""
    content = INDEX.read_bytes()
    return content, gzip.compress(content, compresslevel=6)


def local_addresses():
    addresses = set()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            # connect не посылает UDP-пакет, только выбирает сетевой интерфейс.
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


class GameHandler(BaseHTTPRequestHandler):
    server_version = "ForbiddenFruit/1.1"

    def do_GET(self):
        self.serve_page(with_body=True)

    def do_HEAD(self):
        self.serve_page(with_body=False)

    def serve_page(self, with_body):
        if urlsplit(self.path).path not in ("/", "/index.html"):
            self.send_error(404, "Not Found")
            return
        try:
            stat = INDEX.stat()
            plain, zipped = cached_index(stat.st_mtime_ns, stat.st_size)
        except OSError:
            self.send_error(500, "Could not read game")
            return

        # ETag делает повторную загрузку лёгкой: сервер вернёт 304 без HTML.
        etag = f'"{stat.st_mtime_ns:x}-{stat.st_size:x}"'
        last_modified = formatdate(stat.st_mtime, usegmt=True)
        not_modified = self.headers.get("If-None-Match") == etag
        if not self.headers.get("If-None-Match") and self.headers.get("If-Modified-Since"):
            try:
                changed_since = parsedate_to_datetime(self.headers["If-Modified-Since"])
                if changed_since.tzinfo is None:
                    changed_since = changed_since.replace(tzinfo=timezone.utc)
                not_modified = int(stat.st_mtime) <= int(changed_since.timestamp())
            except (ValueError, TypeError, OverflowError):
                pass

        if not_modified:
            self.send_response(304)
            self.send_header("ETag", etag)
            self.send_header("Last-Modified", last_modified)
            self.send_header("Cache-Control", "private, no-cache")
            self.end_headers()
            return

        encodings = self.headers.get("Accept-Encoding", "").lower()
        use_gzip = any(token.strip().split(";")[0] == "gzip" for token in encodings.split(","))
        body = zipped if use_gzip else plain
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if use_gzip:
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Cache-Control", "private, no-cache")
        self.send_header("ETag", etag)
        self.send_header("Last-Modified", last_modified)
        self.send_header("Vary", "Accept-Encoding")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if with_body:
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass


def main():
    parser = argparse.ArgumentParser(description="FORBIDDEN FRUIT — локальный сервер игры")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="0.0.0.0",
                        help="0.0.0.0 для LAN (по умолчанию), 127.0.0.1 для одного ПК")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Порт должен быть от 1 до 65535")
    try:
        with ThreadingHTTPServer((args.host, args.port), GameHandler) as httpd:
            print(f"FORBIDDEN FRUIT: http://localhost:{args.port}", flush=True)
            if args.host == "0.0.0.0":
                for ip in local_addresses():
                    print(f"Другой ПК в той же сети: http://{ip}:{args.port}", flush=True)
            print("Ctrl+C — остановить сервер.", flush=True)
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nСервер остановлен.")
    except OSError as exc:
        parser.exit(1, f"Не удалось запустить сервер: {exc}\n")


if __name__ == "__main__":
    main()
