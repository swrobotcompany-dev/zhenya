"""Integration tests for LAN co-op. Run: python -m unittest discover -s tests -v"""
import json
import sys
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


class MultiplayerServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.http.server_port}"
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join(timeout=5)

    def api(self, path, payload=None):
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = Request(self.base+path, data=data,
                          headers={"Content-Type": "application/json"})
        with urlopen(request, timeout=3) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def join_pair(self):
        a = self.api("/api/join", {"mode": "create", "name": "Машинист"})
        b = self.api("/api/join", {"mode": "join", "name": "Стрелок", "room": a["room"]})
        self.assertEqual(a["room"], b["room"])
        self.assertNotEqual(a["player"], b["player"])
        return a, b

    def action(self, session, kind, **extra):
        return self.api("/api/action", {
            "room": session["room"], "player": session["player"],
            "action": kind, **extra,
        })

    def test_status_room_and_shared_players(self):
        status = self.api("/api/status")
        self.assertTrue(status["online"])
        a, b = self.join_pair()
        snapshot = self.api(f"/api/state?room={a['room']}&player={a['player']}")
        self.assertEqual(snapshot["state"]["day"], 1)
        self.assertEqual(len(snapshot["players"]), 2)
        self.assertEqual(snapshot["state"]["wagons"][0], "Локомотив")
        # The browser assets must be served from the same HTTP origin.
        with urlopen(self.base+"/multiplayer.js",timeout=3) as resp:
            self.assertIn(b"window.Multiplayer",resp.read())

    def test_single_shared_resource_pool(self):
        a, b = self.join_pair()
        before = a["state"]["fuel"]
        after = self.action(a, "station", choice=0)
        self.assertGreater(after["state"]["fuel"], before)
        # Another player cannot explore the same station a second time.
        with self.assertRaises(HTTPError) as exc:
            self.action(b, "station", choice=0)
        self.assertEqual(exc.exception.code,400)
        other = self.api(f"/api/state?room={b['room']}&player={b['player']}")
        self.assertEqual(other["state"]["fuel"], after["state"]["fuel"])
        self.assertEqual(other["state"]["scrap"], after["state"]["scrap"])

    def test_travel_zombies_and_combat_sync(self):
        a, b = self.join_pair()
        self.action(a, "travel")
        with server.LOCK:
            room = server.ROOMS[a["room"]]
            self.assertIsNotNone(room.trip)
            # Fast-forward a 5.2-second journey without sleeping.
            room.trip["start"] -= 7
        arrived = self.api(f"/api/state?room={b['room']}&player={b['player']}")
        self.assertEqual(arrived["state"]["day"], 2)
        self.assertEqual(arrived["state"]["phase"], "raid")
        self.assertGreaterEqual(len(arrived["state"]["wave"]["enemies"]),4)
        e = arrived["state"]["wave"]["enemies"][0]
        shot = self.action(b, "shoot", x=e["x"]-1200, y=e["ground"]-55)
        self.assertTrue(shot["hit"])
        self.assertEqual(shot["state"]["ammo"],arrived["state"]["ammo"]-1)
        self.action(a, "auto")
        final = self.api(f"/api/state?room={b['room']}&player={b['player']}")
        self.assertEqual(final["state"]["phase"],"station")
        self.assertGreaterEqual(final["state"]["kills"],4)

    def test_chat_and_action_deduplication(self):
        a,b = self.join_pair()
        first=self.api("/api/action",{"room":a["room"],"player":a["player"],
                    "action":"upgrade","kind":"ammo","requestId":"ammo-001"})
        second=self.api("/api/action",{"room":a["room"],"player":a["player"],
                    "action":"upgrade","kind":"ammo","requestId":"ammo-001"})
        self.assertEqual(first["state"]["ammo"],second["state"]["ammo"])
        self.action(b,"chat",text="Прикрываю локомотив!")
        messages=self.api(f"/api/state?room={a['room']}&player={a['player']}")["messages"]
        self.assertEqual(messages[-1]["name"],"Стрелок")
        self.assertEqual(messages[-1]["text"],"Прикрываю локомотив!")

    def test_reject_foreign_player(self):
        a,b = self.join_pair()
        with self.assertRaises(HTTPError) as exc:
            self.api("/api/action", {"room":a["room"],"player":"invalid",
                                    "action":"upgrade","kind":"gun"})
        self.assertEqual(exc.exception.code,400)


if __name__ == "__main__":
    unittest.main()
