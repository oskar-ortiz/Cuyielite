"""Comprobación técnica independiente del RAG real del piloto.

Usa `POST /assistant/query` contra la API con autenticación de piloto. Las
preguntas NO son las de `rag/eval/preguntas.yaml` (que calibraron el umbral).
El umbral no se ajusta: se usa el configurado en el pipeline.

Esta comprobación es técnica: no sustituye la revisión zootécnica humana del
contenido del manual.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4

# Preguntas nuevas, redactadas para este cierre, con página física esperada
# tomada del PDF. No se usaron para calibrar RAG_MIN_SIMILARITY.
IN_CORPUS = [
    (
        "¿Qué materiales se pueden usar para construir comederos y pasteras?",
        {23},
    ),
    (
        "¿En qué año el centro Lope importó animales puros?",
        {12},
    ),
    (
        "¿Qué sintomas se mencionan para la salmonelosis en cuyes?",
        {72},
    ),
    (
        "¿Cual es el aporte de proteina del concentrado para levante y engorde?",
        {45},
    ),
    (
        "¿Que se debe hacer con los comederos cuando no se estan usando?",
        {23},
    ),
]

OUT_OF_CORPUS = [
    "¿Cual es la capital de Japón y cuantos habitantes tiene?",
    "¿Como se declara el impuesto al valor agregado en Chile?",
    "¿Que equipo gano la Liga de Campeones de 2024?",
]


def request(url: str, body: dict, token: str):
    payload = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def login(base_url: str, credentials_file: Path, username: str) -> str:
    data = json.loads(credentials_file.read_text(encoding="utf-8"))
    account = next(item for item in data["cuentas"] if item["username"] == username)
    if not account["password"]:
        raise RuntimeError("La cuenta no tiene contraseña entregada")
    body = {
        "username": username,
        "password": account["password"],
        "device_id": str(uuid4()),
        "device_name": "verificacion-rag",
        "platform": "windows",
    }
    req = urllib.request.Request(
        f"{base_url}/auth/login",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))["access_token"]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verificación independiente del RAG real")
    parser.add_argument("--credentials-file", required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--top-k", type=int, default=5)
    args = parser.parse_args(argv)

    token = login(args.base_url, Path(args.credentials_file), "lope.viewer")
    failures: list[str] = []

    for question, expected_pages in IN_CORPUS:
        result = request(
            f"{args.base_url}/assistant/query",
            {"pregunta": question, "top_k": args.top_k},
            token,
        )
        if set(result) != {"respuesta", "fuentes"}:
            failures.append(f"DTO inesperado para: {question}")
            continue
        pages = set()
        for citation in result["fuentes"]:
            if "p. " in citation:
                tail = citation.split("p. ")[1].strip()
                if tail.isdigit():
                    pages.add(int(tail))
        ok = bool(result["fuentes"]) and any(
            "produccion_cuyes.pdf" in citation for citation in result["fuentes"]
        ) and bool(pages & expected_pages)
        print(
            f"[{'OK' if ok else 'FALLA'}] {question}\n"
            f"       fuentes={result['fuentes']}"
        )
        if not ok:
            failures.append(question)

    for question in OUT_OF_CORPUS:
        result = request(
            f"{args.base_url}/assistant/query",
            {"pregunta": question, "top_k": args.top_k},
            token,
        )
        ok = (
            set(result) == {"respuesta", "fuentes"}
            and not result["fuentes"]
            and "No encontr" in result["respuesta"]
        )
        print(
            f"[{'OK' if ok else 'FALLA'}] (fuera de corpus) {question}\n"
            f"       respuesta={result['respuesta'][:100]!r} fuentes={result['fuentes']}"
        )
        if not ok:
            failures.append(question)

    if failures:
        print(f"{len(failures)} comprobaciones fallaron", file=sys.stderr)
        return 1
    print("RAG real: 5 respuestas con cita correcta y 3 abstenciones correctas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
