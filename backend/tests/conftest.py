"""Fixtures compartidas para las pruebas del backend."""

import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def no_db(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    yield