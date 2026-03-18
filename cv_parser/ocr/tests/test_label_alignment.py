import pytest
import sys
from pathlib import Path

# Add the src directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from ocr_to_hf_layoutlm import create_token_labels, LABELS, label2id


class TestLabelAlignment:
    """Test label-to-wordpiece alignment functionality."""

    def test_create_token_labels_basic(self):
        """1:1 mapping between words and tokens."""
        words = ["Software", "Engineer", "at", "Google"]
        labels = ["B-ROLE", "I-ROLE", "O", "B-COMPANY"]
        word_ids = [0, 1, 2, 3]

        result = create_token_labels(words, labels, word_ids)

        assert result == ["B-ROLE", "I-ROLE", "O", "B-COMPANY"]
        assert len(result) == len(words)

    def test_wordpiece_splitting(self):
        """Word split into multiple tokens should propagate label."""
        words = ["Software", "Engineer"]
        labels = ["B-ROLE", "I-ROLE"]
        word_ids = [0, 1, 1]  # "Engineer" split into two tokens

        result = create_token_labels(words, labels, word_ids)

        assert result == ["B-ROLE", "I-ROLE", "I-ROLE"]

    def test_special_tokens(self):
        """Special tokens (CLS/SEP) should map to O."""
        words = ["Software", "Engineer"]
        labels = ["B-ROLE", "I-ROLE"]
        word_ids = [None, 0, 1, None]

        result = create_token_labels(words, labels, word_ids)

        assert result == ["O", "B-ROLE", "I-ROLE", "O"]

    def test_mixed_none_and_duplicates(self):
        """Stress test: None + repeated word_ids should still align correctly."""
        words = ["Software", "Engineer"]
        labels = ["B-ROLE", "I-ROLE"]
        word_ids = [None, 0, 0, 1, None]  # CLS, split word, SEP

        result = create_token_labels(words, labels, word_ids)

        assert result[0] == "O"  # CLS
        assert result[1] == "B-ROLE"  # first piece
        assert result[2] == "I-ROLE"  # continuation
        assert result[3] == "I-ROLE"
        assert result[4] == "O"  # SEP

    def test_empty_input(self):
        assert create_token_labels([], [], []) == []

    def test_mismatched_lengths(self):
        """Words and labels must match."""
        words = ["Software", "Engineer"]
        labels = ["B-ROLE"]
        word_ids = [0, 1]

        with pytest.raises(ValueError, match="Words and labels must have same length"):
            create_token_labels(words, labels, word_ids)

    def test_unknown_label(self):
        """Unknown label should map to O."""
        words = ["Software"]
        labels = ["B-UNKNOWN"]
        word_ids = [0]

        result = create_token_labels(words, labels, word_ids)
        assert result == ["O"]

    def test_malformed_label(self):
        """Completely malformed label should also map to O."""
        words = ["Software"]
        labels = ["XXX"]
        word_ids = [0]

        result = create_token_labels(words, labels, word_ids)
        assert result == ["O"]

    def test_iob2_normalization(self):
        """IOB2: I-ROLE after O should become B-ROLE."""
        words = ["Lead", "Engineer"]
        labels = ["O", "I-ROLE"]
        word_ids = [0, 1]

        result = create_token_labels(words, labels, word_ids)
        assert result == ["O", "B-ROLE"]

    def test_i_label_without_b(self):
        """I-ROLE as first label should be converted to B-ROLE."""
        words = ["Engineer"]
        labels = ["I-ROLE"]
        word_ids = [0]

        result = create_token_labels(words, labels, word_ids)
        assert result == ["B-ROLE"]

    def test_label_map_consistency(self):
        """All LABELS should exist in label2id and vice versa."""
        for label in LABELS:
            assert label in label2id

        for label, idx in label2id.items():
            assert label in LABELS
            assert 0 <= idx < len(LABELS)


class TestBboxPresence:
    """Test bounding box presence validation."""

    

    def test_validate_bbox_presence(self):
        """Tokens with labels must have valid bounding boxes."""

        def mock_validate(tokens, bboxes, labels):
            for i, (t, b, l) in enumerate(zip(tokens, bboxes, labels)):
                if l != "O" and b is None:
                    raise ValueError(f"Token {t} at {i} has label {l} but no bbox")
                if b is not None:
                    assert len(b) == 4, f"Bbox {b} must have 4 coords"
                    assert all(0 <= v <= 1000 for v in b), f"Bbox {b} out of range"
                    assert b[0] < b[2] and b[1] < b[3], f"Bbox {b} invalid ordering"

        # Valid case
        mock_validate(["Software"], [[100, 100, 200, 200]], ["B-ROLE"])

        # Missing bbox
        with pytest.raises(ValueError, match="no bbox"):
            mock_validate(["Engineer"], [None], ["B-ROLE"])

        # Out of range bbox
        with pytest.raises(AssertionError, match="out of range"):
            mock_validate(["Software"], [[-10, 100, 200, 200]], ["B-ROLE"])

        # Invalid ordering
        with pytest.raises(AssertionError, match="invalid ordering"):
            mock_validate(["Software"], [[200, 100, 100, 200]], ["B-ROLE"])


if __name__ == "__main__":
    pytest.main([__file__])
