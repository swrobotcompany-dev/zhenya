"""Стандартные тесты HTTP-сервера Forbidden Fruit. python -m unittest discover -s tests -v"""
import gzip
import http.client
import threading
import unittest
from http.server import ThreadingHTTPServer

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import GameHandler  # noqa: E402


class HttpCacheTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), GameHandler)
        cls.port = cls.httpd.server_port
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=3)

    def request(self, path="/", method="GET", headers=None):
        client = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        try:
            client.request(method, path, headers=headers or {})
            response = client.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            client.close()

    def test_html_with_gzip(self):
        status, headers, payload = self.request(headers={"Accept-Encoding": "gzip"})
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("Content-Encoding"), "gzip")
        self.assertEqual(headers.get("Vary"), "Accept-Encoding")
        self.assertEqual(len(payload), int(headers["Content-Length"]))
        self.assertIn(b"FORBIDDEN FRUIT", gzip.decompress(payload))

    def test_plain_html(self):
        status, headers, payload = self.request("/index.html")
        self.assertEqual(status, 200)
        self.assertNotIn("Content-Encoding", headers)
        self.assertIn(b"FORBIDDEN FRUIT", payload)
        self.assertIn("ETag", headers)
        self.assertIn("Last-Modified", headers)
        self.assertIn("no-cache", headers["Cache-Control"])

    def test_etag_returns_304(self):
        status, headers, _ = self.request()
        self.assertEqual(status, 200)
        status, updated, body = self.request(headers={"If-None-Match": headers["ETag"]})
        self.assertEqual(status, 304)
        self.assertEqual(body, b"")
        self.assertEqual(updated["ETag"], headers["ETag"])

    def test_if_modified_since(self):
        status, headers, _ = self.request()
        self.assertEqual(status, 200)
        status, _, body = self.request(headers={"If-Modified-Since": headers["Last-Modified"]})
        self.assertEqual(status, 304)
        self.assertEqual(body, b"")

    def test_head_and_404(self):
        status, headers, body = self.request(method="HEAD")
        self.assertEqual(status, 200)
        self.assertEqual(body, b"")
        self.assertGreater(int(headers["Content-Length"]), 1000)
        status, _, _ = self.request("/server.py")
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
