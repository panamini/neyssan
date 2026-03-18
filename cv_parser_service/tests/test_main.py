import asyncio
from io import BytesIO
from pathlib import Path

from fastapi import UploadFile

from cv_parser_service.main import _write_input_tempfile


def test_write_input_tempfile_from_raw_text():
    path, size = asyncio.run(_write_input_tempfile(file=None, raw_text="Hello world"))
    try:
        assert isinstance(path, Path)
        assert path.exists()
        assert size == len("Hello world".encode("utf-8"))
        with path.open("rb") as fh:
            data = fh.read()
        assert data == b"Hello world"
    finally:
        if path.exists():
            path.unlink()


def test_write_input_tempfile_from_upload():
    upload = UploadFile(filename="resume.pdf", file=BytesIO(b"pdf-bytes"))
    path, size = asyncio.run(_write_input_tempfile(file=upload, raw_text=None))
    try:
        assert path.suffix == ".pdf"
        assert size == len(b"pdf-bytes")
        with path.open("rb") as fh:
            data = fh.read()
        assert data == b"pdf-bytes"
    finally:
        if path.exists():
            path.unlink()
