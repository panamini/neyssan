#!/usr/bin/env python3
"""
Tests for the OCR hybrid pipeline integration.
"""

import pytest
import tempfile
import json
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import sys

pytest.importorskip("spacy")
pytest.skip(
    "Hybrid OCR pipeline relies on full spaCy postprocessing stack; skipped in lightweight runtime.",
    allow_module_level=True,
)

# Add the project root to sys.path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from cv_parser.ocr_hybrid_pipeline import HybridCVParser


class TestHybridCVParser:
    """Test the hybrid OCR + SpaCy pipeline integration."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.test_pdf = Path(self.temp_dir) / "test.pdf"
        self.test_pdf.write_text("Mock PDF content")
        
        # Mock SpaCy model path
        self.spacy_model_path = "test_model"
    
    def teardown_method(self):
        """Clean up test environment."""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    @patch('cv_parser.ocr_hybrid_pipeline.SpacyCVParser')
    @patch('cv_parser.ocr_hybrid_pipeline.CVParserOCR')
    def test_hybrid_parser_initialization(self, mock_ocr_parser, mock_spacy_parser):
        """Test hybrid parser initialization with OCR enabled."""
        # Mock OCR parser availability
        with patch('cv_parser.ocr_hybrid_pipeline.OCR_AVAILABLE', True):
            hybrid_parser = HybridCVParser(
                spacy_model_path=self.spacy_model_path,
                ocr_model_path="ocr_model"
            )
        
        assert hybrid_parser.spacy_parser is not None
        assert hybrid_parser.ocr_parser is not None
        mock_spacy_parser.assert_called_once_with(self.spacy_model_path)
        mock_ocr_parser.assert_called_once()
    
    @patch('cv_parser.ocr_hybrid_pipeline.SpacyCVParser')
    def test_hybrid_parser_initialization_no_ocr(self, mock_spacy_parser):
        """Test hybrid parser initialization without OCR."""
        # Mock OCR as unavailable
        with patch('cv_parser.ocr_hybrid_pipeline.OCR_AVAILABLE', False):
            hybrid_parser = HybridCVParser(
                spacy_model_path=self.spacy_model_path
            )
        
        assert hybrid_parser.spacy_parser is not None
        assert hybrid_parser.ocr_parser is None
        mock_spacy_parser.assert_called_once_with(self.spacy_model_path)
    
    @patch('cv_parser.ocr_hybrid_pipeline.SpacyCVParser')
    @patch('cv_parser.ocr_hybrid_pipeline.CVParserOCR')
    def test_parse_pdf_both_pipelines(self, mock_ocr_parser_class, mock_spacy_parser_class):
        """Test PDF parsing with both OCR and SpaCy pipelines."""
        # Mock parser instances
        mock_spacy_parser = Mock()
        mock_spacy_parser.parse_path.return_value = {
            "entities": [
                {"text": "Software Engineer", "label": "ROLE", "confidence": 0.9}
            ]
        }
        mock_spacy_parser_class.return_value = mock_spacy_parser
        
        mock_ocr_parser = Mock()
        mock_ocr_parser.process_pdf.return_value = {
            "entities": [
                {"text": "Google", "label": "COMPANY", "confidence": 0.8}
            ],
            "layout": {"page_count": 1},
            "pages": [{"page_num": 1, "width": 1000, "height": 1000}]
        }
        mock_ocr_parser_class.return_value = mock_ocr_parser
        
        # Mock postprocessing functions
        with patch('cv_parser.ocr_hybrid_pipeline.normalize_entities') as mock_norm_ent, \
             patch('cv_parser.ocr_hybrid_pipeline.normalize_dates') as mock_norm_dates, \
             patch('cv_parser.ocr_hybrid_pipeline.deduplicate_skills') as mock_dedup:
            
            mock_norm_ent.side_effect = lambda x: x
            mock_norm_dates.side_effect = lambda x: x
            mock_dedup.side_effect = lambda x: x
            
            # Initialize parser
            with patch('cv_parser.ocr_hybrid_pipeline.OCR_AVAILABLE', True):
                hybrid_parser = HybridCVParser(
                    spacy_model_path=self.spacy_model_path,
                    ocr_model_path="ocr_model"
                )
            
            # Parse PDF
            result = hybrid_parser.parse_pdf(self.test_pdf)
            
            # Verify both parsers were called
            mock_spacy_parser.parse_path.assert_called_once_with(self.test_pdf)
            mock_ocr_parser.process_pdf.assert_called_once()
            
            # Verify combined results
            assert "entities" in result
            assert len(result["entities"]) == 2
            assert "layout" in result
            assert "parsing_methods" in result
            assert "spacy" in result["parsing_methods"]
            assert "ocr" in result["parsing_methods"]
            
            # Verify entity sources
            sources = [entity.get("source") for entity in result["entities"]]
            assert "spacy" in sources
            assert "ocr" in sources
    
    @patch('cv_parser.ocr_hybrid_pipeline.SpacyCVParser')
    def test_parse_pdf_spacy_only(self, mock_spacy_parser_class):
        """Test PDF parsing with SpaCy only (OCR disabled)."""
        # Mock SpaCy parser
        mock_spacy_parser = Mock()
        mock_spacy_parser.parse_path.return_value = {
            "entities": [
                {"text": "Software Engineer", "label": "ROLE", "confidence": 0.9}
            ]
        }
        mock_spacy_parser_class.return_value = mock_spacy_parser
        
        # Mock postprocessing
        with patch('cv_parser.ocr_hybrid_pipeline.normalize_entities') as mock_norm_ent, \
             patch('cv_parser.ocr_hybrid_pipeline.normalize_dates') as mock_norm_dates, \
             patch('cv_parser.ocr_hybrid_pipeline.deduplicate_skills') as mock_dedup:
            
            mock_norm_ent.side_effect = lambda x: x
            mock_norm_dates.side_effect = lambda x: x
            mock_dedup.side_effect = lambda x: x
            
            # Initialize parser without OCR
            with patch('cv_parser.ocr_hybrid_pipeline.OCR_AVAILABLE', False):
                hybrid_parser = HybridCVParser(spacy_model_path=self.spacy_model_path)
            
            # Parse PDF
            result = hybrid_parser.parse_pdf(self.test_pdf)
            
            # Verify only SpaCy parser was called
            mock_spacy_parser.parse_path.assert_called_once_with(self.test_pdf)
            
            # Verify results
            assert "entities" in result
            assert len(result["entities"]) == 1
            assert result["entities"][0]["source"] == "spacy"
            assert "spacy" in result["parsing_methods"]
            assert "ocr" not in result["parsing_methods"]
    
    @patch('cv_parser.ocr_hybrid_pipeline.SpacyCVParser')
    @patch('cv_parser.ocr_hybrid_pipeline.CVParserOCR')
    def test_confidence_calculation(self, mock_ocr_parser_class, mock_spacy_parser_class):
        """Test confidence score calculation."""
        # Mock parsers
        mock_spacy_parser = Mock()
        mock_spacy_parser.parse_path.return_value = {
            "entities": [
                {"text": "Software Engineer", "label": "ROLE", "confidence": 0.9},
                {"text": "Python", "label": "SKILL", "confidence": 0.8}
            ]
        }
        mock_spacy_parser_class.return_value = mock_spacy_parser
        
        mock_ocr_parser = Mock()
        mock_ocr_parser.process_pdf.return_value = {
            "entities": [
                {"text": "Google", "label": "COMPANY", "confidence": 0.8},
                {"text": "Python", "label": "SKILL", "confidence": 0.7}
            ]
        }
        mock_ocr_parser_class.return_value = mock_ocr_parser
        
        # Mock postprocessing
        with patch('cv_parser.ocr_hybrid_pipeline.normalize_entities') as mock_norm_ent, \
             patch('cv_parser.ocr_hybrid_pipeline.normalize_dates') as mock_norm_dates, \
             patch('cv_parser.ocr_hybrid_pipeline.deduplicate_skills') as mock_dedup:
            
            mock_norm_ent.side_effect = lambda x: x
            mock_norm_dates.side_effect = lambda x: x
            mock_dedup.side_effect = lambda x: x
            
            # Initialize parser
            with patch('cv_parser.ocr_hybrid_pipeline.OCR_AVAILABLE', True):
                hybrid_parser = HybridCVParser(
                    spacy_model_path=self.spacy_model_path,
                    ocr_model_path="ocr_model"
                )
            
            # Parse PDF
            result = hybrid_parser.parse_pdf(self.test_pdf)
            
            # Verify confidence scores
            assert "confidence_scores" in result
            confidence_scores = result["confidence_scores"]
            
            # SKILL should have higher confidence (found by both sources)
            assert "SKILL" in confidence_scores
            assert "ROLE" in confidence_scores
            assert "COMPANY" in confidence_scores
            
            # SKILL confidence should be higher than others
            assert confidence_scores["SKILL"] > confidence_scores["ROLE"]
            assert confidence_scores["SKILL"] > confidence_scores["COMPANY"]
    
    @patch('cv_parser.ocr_hybrid_pipeline.SpacyCVParser')
    def test_parse_text_method(self, mock_spacy_parser_class):
        """Test text parsing method (SpaCy only)."""
        # Mock SpaCy parser
        mock_spacy_parser = Mock()
        mock_spacy_parser.parse_text.return_value = {
            "entities": [{"text": "Test Entity", "label": "TEST"}]
        }
        mock_spacy_parser_class.return_value = mock_spacy_parser
        
        # Initialize parser
        hybrid_parser = HybridCVParser(spacy_model_path=self.spacy_model_path)
        
        # Parse text
        result = hybrid_parser.parse_text("Test text content")
        
        # Verify SpaCy parser was called
        mock_spacy_parser.parse_text.assert_called_once_with("Test text content")
        assert "entities" in result
    
    def test_missing_pdf_handling(self):
        """Test error handling for missing PDF files."""
        with patch('cv_parser.ocr_hybrid_pipeline.SpacyCVParser'):
            hybrid_parser = HybridCVParser(spacy_model_path=self.spacy_model_path)
        
        missing_pdf = Path("/nonexistent/file.pdf")
        
        with pytest.raises(FileNotFoundError):
            hybrid_parser.parse_pdf(missing_pdf)


if __name__ == "__main__":
    pytest.main([__file__])
