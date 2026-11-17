"""Verificación de cuentas del piloto contra la API real.

Comprueba, usando credenciales entregadas en un archivo privado, que:

- admin y viewer inician sesión en el dispositivo compartido del piloto;
- `/auth/me` devuelve el ámbito Centro Lope;
- el refresh restaura la sesión;
- el viewer recibe 403 ante una escritura (sin que llegue a persistir nada);
- una solicitud sin token recibe 401.

Nunca imprime contraseñas ni tokens.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4

REPO_ROOT = Path(__file__).resolve().parents[2]


def load_env(path: Path) -> dict[str, str]:
    values = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip()
    return values


def request(url: str, method: str = "GET", body: dict | None = None, token: str | None = None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        try:
            detail = json.loads(error.read().decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            detail = {}
        return error.code, detail


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verifica el acceso del piloto local")
    parser.add_argument("--credentials-file", required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--device-id", default=None, help="UUID del dispositivo compartido")
    args = parser.parse_args(argv)

    credentials = json.loads(Path(args.credentials_file).read_text(encoding="utf-8"))
    scope_id = credentials["ambito"]["scope_id"]
    device_id = args.device_id or str(uuid4())
    sessions: dict[str, dict] = {}

    print(f"Dispositivo compartido del piloto: {device_id}")
    for account in credentials["cuentas"]:
        username, password = account["username"], account["password"]
        if not password:
            print(f"{username}: pendiente de entrega privada; se omite")
            continue
        code, session = request(
            f"{args.base_url}/auth/login",
            "POST",
            {
                "username": username,
                "password": password,
                "device_id": device_id,
                "device_name": "piloto-local-verificacion",
                "platform": "windows",
            },
        )
        if code != 200:
            print(f"{username}: login FALLO ({code}: {session})")
            return 1
        if session["user"]["role"] != account["role"] or session["scope_id"] != scope_id:
            print(f"{username}: login con rol/ámbito inesperados")
            return 1
        token = session["access_token"]
        code, me = request(f"{args.base_url}/auth/me", token=token)
        if code != 200 or me["user"]["username"] != username:
            print(f"{username}: /auth/me FALLO ({code})")
            return 1
        code, refreshed = request(
            f"{args.base_url}/auth/refresh",
            "POST",
            {"refresh_token": session["refresh_token"]},
        )
        if code != 200:
            print(f"{username}: refresh FALLO ({code}: {refreshed})")
            return 1
        code, me2 = request(f"{args.base_url}/auth/me", token=refreshed["access_token"])
        if code != 200 or me2["user"]["username"] != username:
            print(f"{username}: sesión restaurada FALLO ({code})")
            return 1
        # La rotación revoca la sesión anterior: el token vigente es el del refresh.
        sessions[account["role"]] = refreshed["access_token"]
        print(f"{username}: login, /auth/me y refresh OK (rol {account['role']})")

    viewer = sessions.get("viewer")
    if viewer:
        body = {
            "protocol_version": 2,
            "device_id": device_id,
            "operations": [],
        }
        code, detail = request(
            f"{args.base_url}/sync/v2/push", "POST", body, token=viewer
        )
        if code != 403 or detail.get("detail") != "ROL_SIN_ESCRITURA":
            print(f"viewer: intento de escritura no rechazado ({code}: {detail})")
            return 1
        print("viewer: escritura rechazada con 403 ROL_SIN_ESCRITURA (sin persistencia)")

    code, _ = request(f"{args.base_url}/auth/me")
    if code != 401:
        print(f"sin token: se esperaba 401 y se obtuvo {code}")
        return 1
    print("sin token: 401 OK")
    print("Verificación de cuentas completada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
