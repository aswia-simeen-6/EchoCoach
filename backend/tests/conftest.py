import os
import pytest

def pytest_configure(config):
    os.environ.setdefault("GROQ_API_KEY", "test-key-for-pytest")
