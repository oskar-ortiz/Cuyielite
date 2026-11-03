"""Acceso a PostgreSQL central mediante Psycopg."""

import os
from contextlib import contextmanager

import psycopg
from psycopg import Connection


def get_database_url() -> str | None:
    return os.environ.get("DATABASE_URL")


@contextmanager
def get_connection():
    url = get_database_url()
    if not url:
        raise RuntimeError("DATABASE_URL no configurada")
    conn = psycopg.connect(url)
    try:
        yield conn
    finally:
        conn.close()