from PIL import Image

from cv_parser.extract import ocr_pdf


class _DummyWord:
    def __init__(self, value: str) -> None:
        self.value = value


class _DummyLine:
    def __init__(self, *words: _DummyWord) -> None:
        self.words = list(words)


class _DummyBlock:
    def __init__(self, *lines: _DummyLine) -> None:
        self.lines = list(lines)


class _DummyPage:
    def __init__(self, *blocks: _DummyBlock) -> None:
        self.blocks = list(blocks)


class _DummyResult:
    def __init__(self, pages) -> None:
        self.pages = pages


class _FakePredictor:
    def __call__(self, _inputs):
        return _DummyResult([
            _DummyPage(
                _DummyBlock(
                    _DummyLine(_DummyWord("John"), _DummyWord("Doe")),
                    _DummyLine(_DummyWord("Software"), _DummyWord("Engineer")),
                )
            )
        ])


def test_doctr_extract_from_images_produces_text():
    predictor = _FakePredictor()
    image = Image.new("RGB", (64, 64), "white")

    text, diagnostics = ocr_pdf._doctr_extract_from_images(predictor, [image], lang="en")

    assert "John Doe" in text
    assert diagnostics["engine"] == "doctr"
    assert diagnostics["ocr_blocks"] >= 2
    assert diagnostics["ocr_chars"] == len(text)
