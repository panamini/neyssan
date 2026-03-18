import pytest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch, MagicMock
import sys

# Add the src directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from pdf_to_images import pdf_to_images  # ✅ match actual function name


class TestPdfToImages:
    """Unit tests for PDF → image conversion."""

    def setup_method(self):
        """Set up temporary test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.pdf_path = Path(self.temp_dir) / "test.pdf"
        # Create a dummy file to simulate a PDF
        with open(self.pdf_path, 'w') as f:
            f.write("Mock PDF content")

    def teardown_method(self):
        """Tear down temporary test environment."""
        shutil.rmtree(self.temp_dir)

    @patch('pdf_to_images.convert_from_path')
    def test_creates_output_directory(self, mock_convert):
        """Should create output directory if it does not exist."""
        mock_convert.return_value = []
        output_dir = Path(self.temp_dir) / "new_output"
        assert not output_dir.exists()

        result = pdf_to_images(str(self.pdf_path), str(output_dir))
        assert output_dir.exists()
        assert result == []

    @patch('pdf_to_images.convert_from_path')
    def test_returns_correct_paths(self, mock_convert):
        """Should return correctly named PNG file paths."""
        # Mock page objects with save method
        mock_page1, mock_page2 = MagicMock(), MagicMock()

        def mock_save(path):
            Path(path).touch()  # create empty file

        mock_page1.save = mock_save
        mock_page2.save = mock_save
        mock_convert.return_value = [mock_page1, mock_page2]

        result = pdf_to_images(str(self.pdf_path), str(self.temp_dir))

        # Assert two pages were produced
        assert len(result) == 2
        assert all(Path(path).exists() for path in result)
        assert all(path.endswith(".png") for path in result)

        # Assert naming convention
        assert "test_page1.png" in result[0]
        assert "test_page2.png" in result[1]

    @patch('pdf_to_images.convert_from_path')
    def test_passes_dpi_to_pdf2image(self, mock_convert):
        """Should forward DPI parameter to convert_from_path."""
        mock_convert.return_value = []
        pdf_to_images(str(self.pdf_path), str(self.temp_dir), dpi=200)

        mock_convert.assert_called_once()
        _, kwargs = mock_convert.call_args
        assert kwargs['dpi'] == 200

    def test_raises_for_missing_pdf(self):
        """Should raise FileNotFoundError for missing PDF."""
        missing_pdf = Path(self.temp_dir) / "nonexistent.pdf"
        with pytest.raises(FileNotFoundError):
            pdf_to_images(str(missing_pdf), str(self.temp_dir))

    @patch('pdf_to_images.convert_from_path')
    def test_raises_on_pdf2image_error(self, mock_convert):
        """Should raise the original exception when pdf2image fails."""
        mock_convert.side_effect = Exception("PDF conversion failed")
        with pytest.raises(Exception, match="PDF conversion failed"):
            pdf_to_images(str(self.pdf_path), str(self.temp_dir))


if __name__ == "__main__":
    pytest.main([__file__])
