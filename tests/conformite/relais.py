"""Serveur relais : cache, file d'attente hors lien et rejeu, avec une vraie coupure du serveur central.

Prerequis : pile docker-compose sur http://localhost:8088 avec le jeu de demonstration, et un relais lance :
  java -jar backend/target/formation-api-*.jar --server.port=8090 --app.relay.central-url=http://localhost:8088 \
       --app.relay.dir=./relay-data --app.seed.demo-data=false --spring.datasource.url=jdbc:h2:mem:relay \
       --app.relay.replay-ms=5000
La coupure du central est simulee en arretant le proxy nginx (docker compose stop frontend), puis retablie.
Usage : python tests/conformite/relais.py   (code de sortie 1 si une verification echoue)
"""
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request

R = "http://localhost:8090/api"
C = "http://localhost:8088/api"
results = []


def call(base, m, p, t=None, b=None, raw=False):
    r = urllib.request.Request(base + p, method=m, data=json.dumps(b).encode() if b is not None else None)
    r.add_header("Content-Type", "application/json")
    if t:
        r.add_header("Authorization", "Bearer " + t)
    try:
        with urllib.request.urlopen(r, timeout=40) as x:
            body = x.read()
            return x.status, dict(x.headers), (body if raw else json.loads(body or b"null"))
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()[:150].decode("utf-8", "replace")
    except Exception as e:  # central coupe : comportement attendu
        return 0, {}, str(e)[:80]


def ok(name, cond, detail=""):
    results.append(bool(cond))
    print("OK   " if cond else "ECHEC", name, detail)


s, h, a = call(R, "POST", "/auth/login", b={"email": "jeune@demo.local", "password": "Demo1234!"})
tok = a["token"]
ok("connexion via le relais", s == 200)
call(R, "POST", "/enrollments", tok, {"courseId": 14, "method": "GRATUIT"})
s, h, pkg = call(R, "GET", "/courses/14/package", tok)
ok("paquet de cours via le relais (central joignable)", s == 200)
l1 = pkg["lessons"][0]
answers = [q["correctIndex"] for q in l1["checks"]]

print("--- coupure du central")
subprocess.run(["docker", "compose", "stop", "frontend"], capture_output=True)
try:
    s, _, _ = call(C, "GET", "/public/catalog")
    ok("central injoignable", s != 200, str(s))
    s, h, _ = call(R, "GET", "/courses/14/package", tok)
    ok("paquet servi depuis le cache du relais", s == 200 and h.get("X-Relay-Cache") == "hit", str(s))
    s, h, m = call(R, "GET", "/media/5b3a9c71-2e6d-4a0f-8c47-9d1e3f6a2b33.mp4", raw=True)
    ok("video servie localement par le relais", s == 200 and isinstance(m, bytes) and len(m) > 100000)
    item = {"lessonId": l1["id"], "completedAt": "2026-11-19T10:00:00Z", "timeSpentSeconds": 120, "offline": True, "checkAnswers": answers}
    s, h, r = call(R, "POST", "/sync/progress", tok, {"items": [item]})
    ok("progression acceptee et mise en file", s == 200 and h.get("X-Relay-Queued") == "true", str(s))
    s, _, _ = call(R, "POST", "/courses/14/quiz", tok, {"answers": [0, 0]})
    ok("evaluation finale refusee proprement (necessite le central)", s == 503, str(s))
    st = call(R, "GET", "/relay/status")[2]
    ok("element en attente sur le relais", st["queued"] >= 1, str(st["queued"]))
finally:
    print("--- retour du central")
    subprocess.run(["docker", "compose", "start", "frontend"], capture_output=True)

for _ in range(30):
    time.sleep(3)
    if call(R, "GET", "/relay/status")[2]["queued"] == 0:
        break
ok("file rejouee au retour du lien", call(R, "GET", "/relay/status")[2]["queued"] == 0)
s, h, prog = call(C, "GET", "/progress", tok)
ok("progression enregistree sur le central", s == 200 and any(x["lessonId"] == l1["id"] for x in prog), str(s))
s, h, r = call(R, "POST", "/sync/progress", tok, {"items": [item]})
ok("rejeu idempotent (pas de doublon)", s == 200 and sum(1 for x in r["serverState"] if x["lessonId"] == l1["id"]) == 1)

print(f"\n{sum(results)}/{len(results)} verifications reussies")
sys.exit(0 if all(results) else 1)
