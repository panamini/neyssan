#!/usr/bin/env python3
"""
Hybrid CV Parser - Integration between OCR and SpaCy pipelines

This module combines the OCR-based layout understanding with SpaCy's
linguistic capabilities for comprehensive CV parsing.
"""

import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
import json

# Import OCR pipeline
try:
    from cv_parser.ocr.src.cli import CVParserOCR
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    logging.warning("OCR pipeline not available, falling back to SpaCy only")

# Import existing SpaCy pipeline
from cv_parser.hybrid_pipeline import HybridCVParser as SpacyCVParser
from cv_parser.postprocessing import normalize_entities, normalize_dates, deduplicate_skills


class HybridCVParser:
    """Combines OCR layout analysis with SpaCy linguistic parsing."""
    
    def __init__(self, spacy_model_path: str, ocr_model_path: Optional[str] = None):
        """
        Initialize hybrid parser.
        
        Args:
            spacy_model_path: Path to trained SpaCy model
            ocr_model_path: Path to trained LayoutLMv3 model (optional)
        """
        self.spacy_parser: Optional[SpacyCVParser] = None
        try:
            candidate = SpacyCVParser(spacy_model_path)
        except RuntimeError:
            logging.warning("spaCy hybrid parser unavailable; continuing without spaCy")
            candidate = None
        except Exception as exc:
            logging.warning("Failed to initialise spaCy hybrid parser (%s); continuing without spaCy", exc)
            candidate = None

        if candidate is not None and getattr(candidate, "available", True):
            self.spacy_parser = candidate
        else:
            if candidate is not None:
                logging.info("spaCy hybrid parser reported unavailable; continuing without spaCy")
        
        if OCR_AVAILABLE and ocr_model_path:
            self.ocr_parser = CVParserOCR(model_path=Path(ocr_model_path))
        else:
            self.ocr_parser = None
            logging.info("OCR parser disabled or unavailable")
    
    def parse_pdf(self, pdf_path: Path, output_dir: Optional[Path] = None) -> Dict[str, Any]:
        """
        Parse PDF using both OCR and SpaCy pipelines.
        
        Args:
            pdf_path: Path to PDF file
            output_dir: Directory for intermediate files
            
        Returns:
            Combined parsing results
        """
        if output_dir is None:
            output_dir = Path("hybrid_output")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Parse with SpaCy (existing pipeline)
        spacy_result: Optional[Dict[str, Any]] = None
        if self.spacy_parser is not None:
            logging.info("Parsing with SpaCy pipeline...")
            try:
                spacy_result = self.spacy_parser.parse_path(pdf_path)
            except Exception as exc:
                logging.warning("SpaCy parsing failed (%s); falling back to OCR-only", exc)
                spacy_result = None

        # Parse with OCR if available
        ocr_result = None
        if self.ocr_parser:
            logging.info("Parsing with OCR pipeline...")
            ocr_result = self.ocr_parser.process_pdf(pdf_path, output_dir / "ocr")
        
        # Combine results
        combined = self._combine_results(spacy_result, ocr_result, pdf_path)
        
        # Apply postprocessing
        combined = self._postprocess(combined)
        
        return combined
    
    def _combine_results(self, spacy_result: Dict, ocr_result: Optional[Dict], pdf_path: Path) -> Dict[str, Any]:
        """Combine SpaCy and OCR parsing results."""
        combined = {
            "source": str(pdf_path),
            "entities": [],
            "layout": {},
            "confidence_scores": {},
            "parsing_methods": ["spacy"]
        }
        
        # Add SpaCy entities
        if spacy_result and "entities" in spacy_result:
            for entity in spacy_result["entities"]:
                entity["source"] = "spacy"
                combined["entities"].append(entity)
        
        # Add OCR entities if available
        if ocr_result and "entities" in ocr_result:
            combined["parsing_methods"].append("ocr")
            for entity in ocr_result["entities"]:
                entity["source"] = "ocr"
                combined["entities"].append(entity)
        
        # Add layout information from OCR
        if ocr_result and "layout" in ocr_result:
            combined["layout"] = ocr_result["layout"]
        
        # Add page information from OCR
        if ocr_result and "pages" in ocr_result:
            combined["pages"] = ocr_result["pages"]
        
        # Calculate confidence scores
        combined["confidence_scores"] = self._calculate_confidence(combined["entities"])
        
        return combined
    
    def _calculate_confidence(self, entities: List[Dict]) -> Dict[str, float]:
        """Calculate confidence scores based on source agreement."""
        source_counts = {}
        for entity in entities:
            source = entity.get("source", "unknown")
            label = entity.get("label", "unknown")
            key = f"{source}_{label}"
            source_counts[key] = source_counts.get(key, 0) + 1
        
        # Simple confidence: higher when multiple sources agree
        confidence_scores = {}
        for entity in entities:
            label = entity.get("label", "unknown")
            source = entity.get("source", "unknown")
            
            # Count how many sources found this entity type
            total_sources = sum(1 for k in source_counts.keys() if k.endswith(f"_{label}"))
            confidence_scores[label] = min(total_sources / 2.0, 1.0)  # Normalize to 0-1
        
        return confidence_scores
    
    def _postprocess(self, data: Dict) -> Dict:
        """Apply postprocessing to combined results."""
        # Normalize entities
        if "entities" in data:
            data["entities"] = normalize_entities(data["entities"])
        
        # Normalize dates
        data = normalize_dates(data)
        
        # Deduplicate skills
        data = deduplicate_skills(data)
        
        return data
    
    def parse_text(self, text: str) -> Dict[str, Any]:
        """
        Parse plain text using SpaCy pipeline only.
        
        Args:
            text: Plain text to parse
            
        Returns:
            Parsing results
        """
        if self.spacy_parser is None:
            logging.info("SpaCy hybrid parser unavailable; returning empty result for text parse")
            return {}
        try:
            return self.spacy_parser.parse_text(text)
        except Exception as exc:
            logging.warning("SpaCy text parsing failed (%s); returning empty result", exc)
            return {}


def main():
    """Command-line interface for hybrid CV parser."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Hybrid CV Parser")
    parser.add_argument("input_pdf", help="Path to input PDF file")
    parser.add_argument("--spacy-model", required=True, help="Path to SpaCy model")
    parser.add_argument("--ocr-model", help="Path to OCR model (LayoutLMv3)")
    parser.add_argument("--output-dir", default="hybrid_output", help="Output directory")
    parser.add_argument("--no-ocr", action="store_true", help="Disable OCR processing")
    
    args = parser.parse_args()
    
    pdf_path = Path(args.input_pdf)
    if not pdf_path.exists():
        logging.error(f"PDF file not found: {pdf_path}")
        return 1
    
    # Initialize parser
    ocr_model_path = None if args.no_ocr else args.ocr_model
    hybrid_parser = HybridCVParser(
        spacy_model_path=args.spacy_model,
        ocr_model_path=ocr_model_path
    )
    
    # Parse PDF
    result = hybrid_parser.parse_pdf(pdf_path, Path(args.output_dir))
    
    # Save results
    output_file = Path(args.output_dir) / f"{pdf_path.stem}_hybrid.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    # Print summary
    print(f"\n=== HYBRID PARSING SUMMARY ===")
    print(f"Entities found: {len(result.get('entities', []))}")
    print(f"Parsing methods: {', '.join(result.get('parsing_methods', []))}")
    print(f"Results saved to: {output_file}")
    
    return 0


if __name__ == "__main__":
    main()
