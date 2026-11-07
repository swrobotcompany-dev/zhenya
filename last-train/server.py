#!/usr/bin/env python3
"""The Last Train: dependency-free, LAN cooperative HTTP game server.

Run: python server.py --host 0.0.0.0 --port 8000
All important game mutations are resolved by this server, never trusted from a browser.
Rooms and progress live in RAM until the server is stopped.
"""
from __future__ import annotations

import argparse
import copy
import json
import math
import random
import secrets
import threading
import time
from collections import deque
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parent
ROOMS = {}
LOCK = threading.RLock()
MAX_PLAYERS = 8
MAX_ROOMS = 50
PLAYER_TIMEOUT = 120
ROOM_TIMEOUT = 3600
STATIONS = [
    "Разбитое депо", "Заражённая больница", "Опустевший посёлок",
    "Заброшенный завод", "Военный блокпост", "Радиостанция",
]
ZOMBIES = [
    ("Шатун", 2, 28, 3, 42),
    ("Ползун", 1, 42, 2, 56),
    ("Громила", 5, 13, 9, 55),
    ("Прыгун", 2, 48, 4, 38),
    ("Спороносец", 3, 19, 5, 45),
    ("Двуглавый", 4, 22, 6, 48),
]
WAGONS = ["Локомотив", "Тендер", "Жилой", "Пассажирский", "Склад", "Кухня", "Платформа"]
BUILDS = {
    "farm": ("Ферма", 15),
    "med": ("Медпункт", 18),
    "work": ("Мастерская", 22),
    "guard": ("Охранный", 25),
}


def new_state():
    return dict(day=1, distance=0, worldPosition=0, phase="station", fuel=22,
                food=23, scrap=20, medicine=4, ammo=24, hp=100, crew=6,
                armor=0, gun=1, wagons=list(WAGONS), trainArtVersion=2,
                scavenged=False, attack=0, wave=None, stationType=0,
                safePassage=False, kills=0, gameover=False,
                log=["Пробуждение. Депо разрушено. На восток ведёт единственный путь."])


def add(state, key, delta, cap=None):
    state[key] = max(0, min(cap if cap is not None else 100000, state[key] + delta))


def log(state, message):
    state["log"].insert(0, f"День {state['day']}: {message}")
    del state["log"][35:]


def check_end(state):
    if (state["hp"] <= 0 or state["crew"] <= 0) and not state["gameover"]:
        state["gameover"] = True
        state["phase"] = "lost"
        log(state, "Поезд потерян. Экспедиция окончена.")


class Room:
    def __init__(self, code):
        self.code = code
        self.state = new_state()
        self.players = {}
        self.trip = None
        self.messages = deque(maxlen=35)
        self.version = 1
        self.changed_at = time.monotonic()
        self.last_tick = self.changed_at
        self.last_active = self.changed_at

    def touch(self):
        self.version += 1
        self.changed_at = time.monotonic()

    def members(self):
        now = time.monotonic()
        return [{"name": v["name"], "online": now-v["last"] < 8}
                for v in self.players.values() if now-v["last"] < PLAYER_TIMEOUT]

    def join(self, name, player=None):
        now = time.monotonic()
        if player and player in self.players:
            self.players[player]["last"] = now
            self.players[player]["name"] = name
            self.touch()
            return player
        stale = [pid for pid, p in self.players.items() if now-p["last"] >= PLAYER_TIMEOUT]
        for pid in stale:
            del self.players[pid]
        if len(self.players) >= MAX_PLAYERS:
            raise ValueError("Комната заполнена (максимум 8 игроков).")
        player_id = secrets.token_urlsafe(18)
        self.players[player_id] = dict(name=name, last=now, last_shot=0, seen=deque(maxlen=64))
        log(self.state, name+" подключился к поезду.")
        self.touch()
        return player_id

    def authenticate(self, player_id):
        member = self.players.get(player_id)
        if not member:
            raise ValueError("Подключение потеряно. Присоединитесь к комнате снова.")
        member["last"] = time.monotonic()
        self.last_active = member["last"]
        return member

    def snapshot(self):
        now = time.monotonic()
        trip = None
        if self.trip:
            t = self.trip
            trip = dict(fromStation=t["from"], toStation=t["to"],
                        duration=t["duration"], elapsed=min(t["duration"], now-t["start"]),
                        startWorld=t["startWorld"], distance=2300)
        return dict(state=copy.deepcopy(self.state), trip=trip,
                    players=self.members(), messages=list(self.messages),
                    room=self.code, version=self.version)

    def start_wave(self):
        s = self.state
        count = min(9, 4+s["distance"]//65)
        enemies = []
        for i in range(count):
            kind = (i+s["day"]) % 6
            hp = ZOMBIES[kind][1] + s["day"]//14
            enemies.append(dict(id=s["day"]*100+i, kind=kind, hp=hp, maxHp=hp,
                                x=1762+170+i*72, ground=424+(i%3)*8,
                                seed=s["day"]*17+i*31, cooldown=i*.15, dead=False))
        s["wave"] = dict(enemies=enemies, kills=0, damage=0)
        s["attack"] = count

    def trigger_raid(self):
        s = self.state
        s["phase"] = "raid"
        self.start_wave()

    def finish_wave(self):
        s = self.state
        kills = s["wave"]["kills"] if s["wave"] else 0
        s["wave"] = None
        s["attack"] = 0
        s["phase"] = "station"
        log(s, f"Нападение отбито, уничтожено зомби: {kills}.")

    def tick(self, now=None):
        now = now if now is not None else time.monotonic()
        dt = min(max(0, now-self.last_tick), 1.0)
        self.last_tick = now
        if self.trip and now-self.trip["start"] >= self.trip["duration"]:
            self.arrive()
        s = self.state
        if s["phase"] != "raid" or s["gameover"] or not s.get("wave"):
            return
        damage = 0
        for e in s["wave"]["enemies"]:
            if e["hp"] <= 0:
                continue
            _, _, speed, hit, reach = ZOMBIES[e["kind"]]
            limit = 1762+reach*.3
            if e["x"] > limit:
                e["x"] = max(limit, e["x"]-speed*dt)
            else:
                e["cooldown"] += dt
                if e["cooldown"] >= 2.4:
                    e["cooldown"] = 0
                    damage += max(1, hit-s["armor"]-(2 if "Охранный" in s["wagons"] else 0))
        if damage:
            add(s, "hp", -damage)
            s["wave"]["damage"] += damage
            log(s, f"Зомби добрались до локомотива: −{damage} прочности.")
            check_end(s)
            self.touch()
        # Keep server snapshots visibly changing as zombies approach.
        elif any(e["hp"] > 0 for e in s["wave"]["enemies"]):
            self.version += 1

    def arrive(self):
        t = self.trip
        if not t:
            return
        self.trip = None
        s = self.state
        add(s, "fuel", -3)
        add(s, "food", -max(1, math.ceil(s["crew"]/2)))
        if "Ферма" in s["wagons"]:
            add(s, "food", 4)
        if "Мастерская" in s["wagons"]:
            add(s, "scrap", 3)
        if "Медпункт" in s["wagons"]:
            add(s, "hp", 8, cap=100)
        if s["food"] == 0:
            add(s, "crew", -1)
            log(s, "Из-за голода погиб один выживший.")
        s["day"] += 1
        s["distance"] += t["km"]
        s["worldPosition"] += 2300
        s["scavenged"] = False
        s["wave"] = None
        s["stationType"] = t["to"]
        safe = s["safePassage"]
        s["safePassage"] = False
        if not s["gameover"] and not safe and (s["day"] == 2 or random.random() < .5):
            self.trigger_raid()
            log(s, "На путях зомби! Стреляйте по ним или включите автооборону.")
        else:
            s["phase"] = "station"
            s["attack"] = 0
            log(s, f"Прибытие: {STATIONS[s['stationType']]}.")
        check_end(s)
        self.touch()

    def station_choice(self, choice):
        s = self.state
        if s["scavenged"] or not isinstance(choice, int) or choice not in (0, 1, 2):
            raise ValueError("Эта остановка уже исследована или вариант недоступен.")
        p = s["stationType"]
        if p == 0:
            if choice == 0:
                a = random.randint(7, 11); add(s, "fuel", a); msg = f"+{a} топлива."
                if random.random() < .22: add(s, "hp", -6); msg += " −6 прочности."
            elif choice == 1:
                a = random.randint(11, 16); add(s, "scrap", a); msg = f"+{a} металла."
                if random.random() < .3: self.trigger_raid(); msg += " Зомби услышали шум!"
            else:
                a = random.randint(7, 11); add(s, "ammo", a); add(s, "medicine", 1)
                msg = f"+{a} патронов и аптечка."
        elif p == 1:
            if choice == 0:
                a = random.randint(3, 5); add(s, "medicine", a); msg = f"+{a} медикаментов."
                if random.random() < .26: add(s, "hp", -7); msg += " −7 прочности."
            elif choice == 1:
                if s["scrap"] < 5 or s["hp"] == 100: raise ValueError("Недостаточно металла или ремонт не нужен.")
                add(s, "scrap", -5); add(s, "hp", 26, cap=100); msg = "Поезд отремонтирован."
            else:
                a = random.randint(8, 12); add(s, "food", a); msg = f"+{a} еды."
                if random.random() < .28: self.trigger_raid(); msg += " На станции зомби!"
        elif p == 2:
            if choice == 0:
                a = random.randint(10, 15); add(s, "food", a); msg = f"+{a} еды."
            elif choice == 1:
                if s["food"] < 4 or s["scrap"] < 4: raise ValueError("Нужны 4 еды и 4 металла.")
                add(s, "food", -4); add(s, "scrap", -4); add(s, "crew", 1)
                msg = "Присоединился новый выживший."
            else:
                a = random.randint(7, 11); b = random.randint(2, 4)
                add(s, "scrap", a); add(s, "fuel", b); msg = f"+{a} металла, +{b} топлива."
        elif p == 3:
            if choice == 0:
                a = random.randint(13, 19); add(s, "scrap", a); msg = f"+{a} металла."
                if random.random() < .3: add(s, "hp", -8); msg += " −8 прочности."
            elif choice == 1:
                a = random.randint(10, 15); add(s, "ammo", a); msg = f"+{a} патронов."
                if random.random() < .46: self.trigger_raid(); msg += " Тревога привлекла зомби!"
            else:
                add(s, "fuel", 6); add(s, "scrap", 4); msg = "+6 топлива, +4 металла."
        elif p == 4:
            if choice == 0:
                a = random.randint(9, 13); add(s, "ammo", a); msg = f"+{a} патронов."
                if random.random() < .24: self.trigger_raid(); msg += " Зомби у бункера!"
            elif choice == 1:
                s["safePassage"] = True; msg = "Следующий переезд безопасен."
            else:
                if s["scrap"] < 6 or s["hp"] == 100: raise ValueError("Недостаточно металла или ремонт не нужен.")
                add(s, "scrap", -6); add(s, "hp", 18, cap=100); msg = "Броня отремонтирована."
        else:
            if choice == 0:
                s["safePassage"] = True; add(s, "fuel", 2)
                msg = "Безопасный маршрут, +2 топлива."
            elif choice == 1:
                add(s, "fuel", 5); add(s, "ammo", 5); msg = "+5 топлива, +5 патронов."
            elif random.random() < .65:
                add(s, "crew", 1); add(s, "food", 3); msg = "Спасён связист: +1 человек и +3 еды."
            else:
                self.trigger_raid(); msg = "Заражённые ответили на сигнал!"
        s["scavenged"] = True
        log(s, STATIONS[p]+": "+msg)
        check_end(s)

    def action(self, member, kind, payload):
        s = self.state
        if kind == "chat":
            text = str(payload.get("text", "")).strip()[:180]
            if not text: raise ValueError("Введите сообщение.")
            self.messages.append({"name": member["name"], "text": text, "at": int(time.time())})
            self.touch()
            return {"message": "Отправлено."}
        if kind == "reset":
            if self.trip: raise ValueError("Нельзя перезапустить поезд во время переезда.")
            self.state = new_state()
            self.trip = None
            self.last_tick = time.monotonic()
            log(self.state, member["name"]+" начал новую совместную экспедицию.")
            self.touch()
            return {"message": "Экспедиция перезапущена."}
        if s["gameover"]:
            raise ValueError("Экспедиция закончена. Начните новую игру.")
        if self.trip:
            raise ValueError("Поезд уже в пути.")
        if kind == "travel":
            if s["phase"] != "station": raise ValueError("Сначала отразите нападение.")
            if s["fuel"] < 3: raise ValueError("Нужно минимум 3 топлива.")
            prev = s["stationType"]
            nxt = (prev+random.randint(1, 5))%6
            self.trip = dict(start=time.monotonic(), duration=5.2, fromStation=prev,
                             **{"from": prev, "to": nxt},
                             km=random.randint(12,24), startWorld=s["worldPosition"])
            log(s, member["name"]+" отправил поезд в путь.")
        elif kind in ("search","station"):
            if s["phase"] != "station": raise ValueError("Сначала отразите нападение.")
            if s["scavenged"]: raise ValueError("На станции уже проведена разведка.")
            if kind == "station":
                choice=payload.get("choice")
                if type(choice) is not int: raise ValueError("Неверный вариант.")
                self.station_choice(choice)
            else:
                s["scavenged"] = True
                a,b,d=random.randint(5,12),random.randint(2,7),random.randint(1,5)
                add(s,"scrap",a);add(s,"fuel",b);add(s,"food",d)
                msg=f"Разведка: +{a} металла, +{b} топлива, +{d} еды."
                if random.random()<.28:
                    m=random.randint(1,3);add(s,"medicine",m);msg+=f" +{m} медикаментов."
                if random.random()<.20:
                    add(s,"crew",-1);msg+=" Один разведчик не вернулся."
                log(s,msg);check_end(s)
        elif kind == "build":
            if s["phase"] != "station": raise ValueError("Сначала отразите нападение.")
            b=BUILDS.get(payload.get("kind"))
            if not b or b[0] in s["wagons"] or s["scrap"]<b[1]: raise ValueError("Нельзя построить вагон.")
            add(s,"scrap",-b[1]);s["wagons"].append(b[0]);log(s,member["name"]+" построил вагон «"+b[0]+"».")
        elif kind == "upgrade":
            if s["phase"] != "station": raise ValueError("Сначала отразите нападение.")
            which=payload.get("kind")
            if which=="gun" and s["scrap"]>=12:
                add(s,"scrap",-12);s["gun"]+=1
            elif which=="armor" and s["scrap"]>=15:
                add(s,"scrap",-15);s["armor"]+=1
            elif which=="ammo" and s["scrap"]>=6:
                add(s,"scrap",-6);add(s,"ammo",8)
            elif which=="heal" and s["medicine"]>=2 and s["hp"]<100:
                add(s,"medicine",-2);add(s,"hp",25,cap=100)
            elif which=="recruit" and s["food"]>=5 and s["scrap"]>=8:
                add(s,"food",-5);add(s,"scrap",-8);add(s,"crew",1)
            elif which=="trade" and s["scrap"]>=5:
                add(s,"scrap",-5);add(s,"fuel",6)
            else: raise ValueError("Недостаточно припасов или улучшение недоступно.")
            log(s,member["name"]+" выбрал улучшение: "+str(which))
        elif kind == "auto":
            if s["phase"]!="raid" or not s["wave"]: raise ValueError("Нападения сейчас нет.")
            foes=sum(1 for e in s["wave"]["enemies"] if e["hp"]>0)
            shots=min(s["ammo"],max(1,math.ceil(foes*.8)));add(s,"ammo",-shots)
            power=s["crew"]+s["gun"]*3+s["armor"]*2+(4 if "Охранный" in s["wagons"] else 0)+shots*2
            dmg=max(1,foes*5-power+random.randint(0,8))
            add(s,"hp",-dmg);s["kills"]+=foes
            log(s,f"{member['name']} отразил {foes} зомби: −{shots} патронов, −{dmg} прочности.")
            check_end(s)
            if not s["gameover"]:self.finish_wave()
        elif kind == "shoot":
            if s["phase"]!="raid" or not s["wave"]: raise ValueError("Сейчас не в кого стрелять.")
            now=time.monotonic()
            if now-member["last_shot"]<.16: raise ValueError("Оружие перезаряжается.")
            if s["ammo"]<1: raise ValueError("Патроны закончились.")
            x,y=payload.get("x"),payload.get("y")
            if not (type(x) in (float,int) and type(y) in (float,int) and
                    math.isfinite(x) and math.isfinite(y) and 0<=x<=960 and 0<=y<=480):
                raise ValueError("Неверная координата прицела.")
            member["last_shot"]=now;add(s,"ammo",-1)
            target=None;rank=float("inf")
            camera=1200
            for e in s["wave"]["enemies"]:
                if e["hp"]<=0:continue
                sx=e["x"]-camera;sy=e["ground"];kindidx=e["kind"]
                radius=53 if kindidx in (1,2) else 36
                top=sy-(112 if kindidx==2 else 108 if kindidx==4 else 100 if kindidx==3 else 91)
                if abs(x-sx)<radius and top-18<y<sy+20:
                    d=abs(x-sx)+abs(y-(sy-55))*.17
                    if d<rank:target=e;rank=d
            msg="Промах."
            if target:
                dmg=max(1,s["gun"]);add(target,"hp",-dmg)
                msg="Попадание!"
                if target["hp"]==0:
                    kindidx=target["kind"]
                    s["wave"]["kills"]+=1;s["kills"]+=1
                    add(s,"scrap",1+(2 if kindidx==2 else 0))
                    msg=member["name"]+" уничтожил: "+ZOMBIES[kindidx][0]
                    log(s,msg)
            if all(e["hp"]<=0 for e in s["wave"]["enemies"]):
                self.finish_wave()
            self.touch()
            return {"message":msg,"hit":bool(target)}
        else:
            raise ValueError("Неизвестное действие.")
        self.touch()
        return {"message":"Действие выполнено."}


def cleanup_rooms():
    now=time.monotonic()
    for code,room in list(ROOMS.items()):
        if now-room.last_active>ROOM_TIMEOUT: del ROOMS[code]


def get_room(code):
    code = str(code or "").strip().upper()
    room=ROOMS.get(code)
    if not room: raise ValueError("Комната не найдена. Проверьте её код.")
    return room


def new_room():
    cleanup_rooms()
    if len(ROOMS)>=MAX_ROOMS: raise ValueError("Сервер занят: слишком много комнат.")
    for _ in range(100):
        code="".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(6))
        if code not in ROOMS:break
    room=Room(code);ROOMS[code]=room
    return room


class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT),**kwargs)

    def send_json(self,data,status=200):
        body=json.dumps(data,ensure_ascii=False,allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Content-Length",str(len(body)))
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        if not urlsplit(self.path).path.startswith("/api/"):
            self.send_header("Cache-Control","no-store")
        super().end_headers()

    def do_GET(self):
        url=urlsplit(self.path)
        if url.path=="/api/status":
            self.send_json({"online":True,"mode":"lan-coop","maxPlayers":MAX_PLAYERS})
            return
        if url.path=="/api/state":
            q=parse_qs(url.query)
            try:
                with LOCK:
                    room=get_room(q.get("room",[""])[0])
                    room.authenticate(q.get("player",[""])[0])
                    room.tick()
                    answer=room.snapshot()
                self.send_json(answer)
            except ValueError as exc:
                self.send_json({"error":str(exc)},400)
            return
        if url.path.startswith("/api/"):
            self.send_json({"error":"Неизвестный адрес API."},404)
            return
        self.path=url.path or "/"
        super().do_GET()

    def do_POST(self):
        route=urlsplit(self.path).path
        if route not in ("/api/join","/api/action"):
            self.send_json({"error":"Неизвестный адрес API."},404);return
        try:
            length=int(self.headers.get("Content-Length","0"))
            if not 0<length<=4096: raise ValueError("Слишком большой запрос.")
            body=json.loads(self.rfile.read(length))
            if not isinstance(body,dict): raise ValueError("Неверный формат данных.")
            with LOCK:
                if route=="/api/join":
                    name=str(body.get("name","Игрок")).strip()[:24] or "Игрок"
                    mode=body.get("mode")
                    room=new_room() if mode=="create" else get_room(body.get("room"))
                    token=room.join(name,body.get("player"))
                    room.last_active=time.monotonic()
                    answer={"player":token,**room.snapshot()}
                else:
                    room=get_room(body.get("room"))
                    member=room.authenticate(str(body.get("player","")))
                    room.tick()
                    req_id=str(body.get("requestId",""))[:60]
                    if req_id and req_id in member["seen"]:
                        answer={"message":"Уже применено.",**room.snapshot()}
                    else:
                        feedback=room.action(member,str(body.get("action","")),body)
                        if req_id:member["seen"].append(req_id)
                        answer={**feedback,**room.snapshot()}
            self.send_json(answer)
        except (ValueError,TypeError,KeyError,json.JSONDecodeError) as exc:
            self.send_json({"error":str(exc)},400)
        except Exception as exc:
            self.log_error("Unexpected multiplayer server error: %s", str(exc))
            self.send_json({"error":"Внутренняя ошибка сервера."},500)


def main():
    parser=argparse.ArgumentParser(description="The Last Train LAN cooperative server")
    parser.add_argument("--host",default="0.0.0.0",help="Listen interface (default: all)")
    parser.add_argument("--port",type=int,default=8000,help="HTTP port (default: 8000)")
    args=parser.parse_args()
    server=ThreadingHTTPServer((args.host,args.port),Handler)
    print(f"\n🚂 ПОСЛЕДНИЙ ПОЕЗД — СЕТЕВОЙ РЕЖИМ")
    print(f"На этом компьютере: http://localhost:{args.port}")
    print(f"С телефона или другого ПК: http://IP_КОМПЬЮТЕРА:{args.port}")
    print("Откройте порт в брандмауэре, если устройство не подключается.")
    print("Игроки должны выбрать «Создать» или присоединиться по коду комнаты.")
    print("Для остановки нажмите Ctrl+C. Комнаты хранятся в оперативной памяти.\n")
    try:
        server.serve_forever(poll_interval=.2)
    except KeyboardInterrupt:
        print("\nСервер остановлен.")
    finally:
        server.server_close()


if __name__=="__main__":
    main()
