from pathlib import Path


def test_worker_docker_runtime_uses_pinned_venv_python():
    dockerfile = Path(__file__).resolve().parents[2] / "Dockerfile.worker"
    source = dockerfile.read_text(encoding="utf-8")
    assert 'PATH="/opt/venv/bin:$PATH"' in source
    assert 'CMD ["/opt/venv/bin/python","-m","backend.worker"]' in source
