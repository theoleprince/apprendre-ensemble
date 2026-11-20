"""Parametrage sans developpement : nouveau public, pays, langue, pack de traduction ; droits d'inscription.

Prerequis : pile docker-compose sur http://localhost:8088 ; mot de passe administrateur dans la variable ADMIN_PWD
(valeur de APP_ADMIN_PASSWORD du fichier .env, jamais affichee).
Usage : ADMIN_PWD=... python tests/conformite/parametrage.py
"""
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

C = "http://localhost:8088/api"
results = []
tag = uuid.uuid4().hex[:6].upper()


def call(m, p, t=None, b=None):
    r = urllib.request.Request(C + p, method=m, data=json.dumps(b).encode() if b is not None else None)
    r.add_header("Content-Type", "application/json")
    if t:
        r.add_header("Authorization", "Bearer " + t)
    try:
        with urllib.request.urlopen(r) as x:
            return x.status, json.loads(x.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:150].decode()


def ok(name, cond, detail=""):
    results.append(bool(cond))
    print("OK   " if cond else "ECHEC", name, detail)


adm = call("POST", "/auth/login", b={"email": "admin@demo.local", "password": os.environ["ADMIN_PWD"]})[1]["token"]
code = "PUBLIC_" + tag
s, _ = call("POST", "/admin/audiences", adm, {"code": code, "label": "Infirmier·ère scolaire " + tag, "icon": "heart", "position": 7,
                                              "baseRole": "APPRENANT", "selfRegistration": True, "active": True})
ok("nouveau public cree sans developpement", s == 200, str(s))
s, _ = call("POST", "/admin/audiences", adm, {"code": "PIRATE_" + tag, "label": "x", "icon": "", "position": 1, "baseRole": "ADMIN",
                                              "selfRegistration": True, "active": True})
ok("public donnant un role d'administration refuse", s == 400, str(s))
ref = call("GET", "/referentiel")[1]
ok("public propose a l'inscription", any(x["code"] == code for x in ref["audiences"]))
email = f"infirmiere.{tag.lower()}@exemple.test"
s, r = call("POST", "/auth/register", b={"email": email, "password": "Infirmiere2026", "fullName": "Ines Infirmiere", "audience": code,
                                         "countryCode": "BJ", "languageCode": "fr", "region": "Borgou", "dataConsent": True})
ok("inscription avec le nouveau public", s == 201 and r["user"]["role"] == "APPRENANT" and r["user"]["audience"] == code, str(s))
s, _ = call("POST", "/auth/register", b={"email": f"pirate.{tag.lower()}@exemple.test", "password": "Pirate20266", "fullName": "P",
                                         "role": "ADMIN", "countryCode": "BJ", "languageCode": "fr", "dataConsent": True})
ok("auto-inscription avec un role d'administration refusee", s == 400, str(s))
ok("nouveau pays", call("PUT", "/admin/countries", adm, {"code": "SN", "name": "Sénégal", "active": True})[0] == 200)
ok("nouvelle langue", call("PUT", "/admin/languages", adm, {"code": "wo", "name": "Wolof", "active": True})[0] == 200)
s, p = call("PUT", "/admin/i18n/wo", adm, {"Catalogue": "Katalog (test)", "Mes cours": "Sama njàng (test)"})
ok("pack de traduction charge a chaud", s == 200 and p["entries"] == 2, str(s))
s, pk = call("GET", "/public/i18n/wo")
ok("pack servi aux appareils", s == 200 and pk.get("Catalogue") == "Katalog (test)")

print(f"\n{sum(results)}/{len(results)} verifications reussies")
sys.exit(0 if all(results) else 1)
