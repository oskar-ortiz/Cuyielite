"""CLI del migrador."""

import argparse
import os
import sys

from .runner import apply_migrations


def main(argv=None):
    parser = argparse.ArgumentParser(description="Migrador transaccional de bases centrales")
    parser.add_argument(
        "--env-var",
        required=True,
        help="Nombre de la variable de entorno que contiene la URL de conexion",
    )
    parser.add_argument(
        "--migrations-dir",
        default=None,
        help="Directorio de migraciones (opcional)",
    )
    args = parser.parse_args(argv)

    url = os.environ.get(args.env_var)
    if not url:
        print(f"Variable de entorno no definida o vacia: {args.env_var}", file=sys.stderr)
        return 1

    from pathlib import Path

    directory = Path(args.migrations_dir) if args.migrations_dir else None
    kwargs = {}
    if directory is not None:
        kwargs["directory"] = directory

    try:
        applied = apply_migrations(url, **kwargs)
    except Exception as exc:
        print(f"Error de migracion: {exc}", file=sys.stderr)
        return 1

    if applied:
        for mig in applied:
            print(f"Aplicada: {mig}")
    else:
        print("Sin cambios: todas las migraciones ya aplicadas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())