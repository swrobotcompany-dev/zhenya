#!/usr/bin/env python3
"""FORBIDDEN FRUIT: лёгкий локальный HTTP-сервер (Python 3, без зависимостей).

Подключение: http://localhost:8000 или http://<локальный-IP-ПК>:8000.
HTML отдаётся с gzip, ETag/Last-Modified и кешируется в оперативной памяти
сервера между запросами. WebSocket и мультиплеер не нужны.
"""
import argparse
import gzip
import ipaddress
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
    """Найти IPv4 компьютера, в том числе на Wi-Fi без доступа к интернету."""
    addresses = set()

    # На Linux получаем адреса непосредственно с сетевых интерфейсов.
    # Это работает даже без DNS, шлюза и подключения к интернету.
    try:
        import fcntl
        import struct

        for _, interface in socket.if_nameindex():
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                    packed = struct.pack("256s", interface.encode("utf-8")[:15])
                    info = fcntl.ioctl(sock.fileno(), 0x8915, packed)  # SIOCGIFADDR
                    addresses.add(socket.inet_ntoa(info[20:24]))
            except (OSError, UnicodeError):
                continue
    except (ImportError, AttributeError, OSError):
        pass

    # Windows и прочие системы: разрешение имени своего компьютера.
    for hostname in (socket.gethostname(), socket.getfqdn()):
        try:
            for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
                addresses.add(info[4][0])
        except OSError:
            pass

    # Дополнительный способ определения активного интерфейса.
    # UDP connect здесь ничего не отправляет и не требует работающего интернета.
    for destination in ("192.168.1.1", "10.0.0.1", "1.1.1.1"):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.connect((destination, 80))
                addresses.add(sock.getsockname()[0])
        except OSError:
            pass

    # На Windows имя хоста иногда разрешается только в 127.0.0.1.
    # В ipconfig ищем именно строки адреса IPv4, а не шлюз или DNS.
    if not any(ip.startswith(("192.168.", "10.", "172.")) for ip in addresses):
        try:
            import subprocess
            import re
            import sys

            if sys.platform == "win32":
                output = subprocess.run(
                    ["ipconfig"], capture_output=True, text=True,
                    errors="replace", timeout=3, check=False
                ).stdout
                for line in output.splitlines():
                    if "IPv4" in line:
                        match = re.search(r"(?<!\d)(?:\d{1,3}\.){3}\d{1,3}(?!\d)", line)
                        if match:
                            addresses.add(match.group())
        except (OSError, subprocess.TimeoutExpired):
            pass

    usable = []
    for ip in addresses:
        try:
            address = ipaddress.IPv4Address(ip)
            if not (address.is_loopback or address.is_link_local
                    or address.is_unspecified or address.is_multicast):
                usable.append(ip)
        except ipaddress.AddressValueError:
            pass

    # Частные адреса (обычно Wi-Fi/Ethernet) выводим перед публичными.
    return sorted(set(usable), key=lambda ip: (not ipaddress.IPv4Address(ip).is_private, ip))


class GameHandler(BaseHTTPRequestHandler):
    server_version = "ForbiddenFruit/1.2"

    def do_GET(self):
        self.serve_page(with_body=True)

    def do_HEAD(self):
        self.serve_page(with_body=False)

    def serve_page(self, with_body):
        path = urlsplit(self.path).path
        if path in ("/health", "/healthz"):
            payload = b'{"status":"ok"}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            if with_body:
                self.wfile.write(payload)
            return
        if path not in ("/", "/index.html"):
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
            port = httpd.server_port
            print(f"FORBIDDEN FRUIT — сервер запущен (порт {port})", flush=True)
            if args.host in ("0.0.0.0", "127.0.0.1", "localhost"):
                print(f"На этом компьютере: http://localhost:{port}/", flush=True)
            else:
                print(f"Адрес сервера: http://{args.host}:{port}/", flush=True)

            if args.host == "0.0.0.0":
                addresses = local_addresses()
                if addresses:
                    print("С других устройств в той же Wi-Fi/LAN сети:", flush=True)
                    for ip in addresses:
                        print(f"  http://{ip}:{port}/", flush=True)
                else:
                    print("IP не определён. Найдите его: ipconfig (Windows) / ip -4 addr (Linux).", flush=True)
                print(f"Проверка соединения: http://<IP_СЕРВЕРА>:{port}/health", flush=True)
                print(f"Если не открывается — разрешите входящие TCP на порт {port} в брандмауэре.", flush=True)
                print("Гостевая Wi-Fi сеть или изоляция клиентов на роутере тоже могут мешать.", flush=True)
            else:
                print("Внимание: с параметром --host доступ может быть ограничен.", flush=True)

            print("Ctrl+C — остановить сервер.", flush=True)
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nСервер остановлен.")
    except OSError as exc:
        parser.exit(1, f"Не удалось запустить сервер: {exc}\n")


if __name__ == "__main__":
    main()
