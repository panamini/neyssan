#!/usr/bin/env python3
"""
CLI Entrypoint for CV Parser OCR Pipeline

Provides a unified command-line interface for running the full OCR pipeline:
PDF → Images → PP-Structure → LayoutLMv3 Inference → Normalized JSON Output
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Dict, List, Any

# Import our pipeline modules

from .pdf_to_images import pdf_to_images
from .run_ppstructure import PPStructureOCR  # goes through the alias we added

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger(__name__)

class CVParserOCR:
    """Main class for CV parsing OCR pipeline."""
    
    def __init__(self, model_path: Path = None):
        """
        Initialize the CV parser.
        
        Args:
            model_path: Path to trained LayoutLMv3 model (optional)
        """
        self.model_path = model_path
        self.ocr_engine = None
        # TODO: Load trained model when model_path is provided
        # For now, we'll just use OCR results without NER
        
    def process_pdf(self, pdf_path: Path, output_dir: Path, dpi: int = 300) -> Dict[str, Any]:
        """
        Process a PDF through the full pipeline.
        
        Args:
            pdf_path: Path to input PDF
            output_dir: Directory for intermediate files and final output
            dpi: Resolution for PDF to image conversion
            
        Returns:
            Dictionary with parsed CV entities
        """
        # Create output directories
        images_dir = output_dir / "images"
        ocr_json_dir = output_dir / "ocr_json"
        results_dir = output_dir / "results"
        
        for dir_path in [images_dir, ocr_json_dir, results_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
        
        log.info(f"Processing PDF: {pdf_path}")
        
        try:
            # Step 1: Convert PDF to images
            log.info("Step 1: Converting PDF to images...")
            image_paths = pdf_to_images(str(pdf_path), str(images_dir), dpi=dpi)
            log.info(f"Generated {len(image_paths)} images")
            
            # Step 2: Run PP-Structure OCR
            log.info("Step 2: Running PP-Structure OCR...")
            if self.ocr_engine is None:
                self.ocr_engine = PPStructureOCR(lang='en')
            
            ocr_results = {}
            for img_path in image_paths:
                result = self.ocr_engine.process_image(str(img_path))
                ocr_results[str(img_path)] = result
                
                # Save individual JSON
                stem = Path(img_path).stem
                json_path = ocr_json_dir / f"{stem}.json"
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)
            
            # Step 3: Parse OCR results and extract entities
            log.info("Step 3: Parsing OCR results...")
            cv_data = self._parse_ocr_results(ocr_results, image_paths)
            
            # Step 4: Save final results
            log.info("Step 4: Saving results...")
            output_file = results_dir / f"{pdf_path.stem}_parsed.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(cv_data, f, ensure_ascii=False, indent=2)
            
            log.info(f"✅ Processing complete. Results saved to: {output_file}")
            return cv_data
            
        except Exception as e:
            log.error(f"Pipeline failed: {e}")
            raise
    
    def _parse_ocr_results(self, ocr_results: Dict, image_paths: List[Path]) -> Dict[str, Any]:
        """
        Parse OCR results and extract CV entities using rule-based approach.
        
        Args:
            ocr_results: Dictionary mapping image paths to OCR results
            image_paths: List of image paths
            
        Returns:
            Structured CV data
        """
        cv_data = {
            "personal_info": {},
            "experience": [],
            "education": [],
            "skills": [],
            "certifications": [],
            "raw_blocks": []
        }
        
        for img_path in image_paths:
            if str(img_path) not in ocr_results:
                continue
                
            ocr_data = ocr_results[str(img_path)]
            
            # Parse each block
            for block in ocr_data:
                block_type = block.get('type', 'text')
                text = block.get('text', '').strip()
                bbox = block.get('bbox')
                
                if not text:
                    continue
                
                # Add raw block
                cv_data["raw_blocks"].append({
                    "type": block_type,
                    "text": text,
                    "bbox": bbox
                })
                
                # Simple rule-based parsing (can be enhanced with ML model)
                self._extract_entities(text, cv_data, bbox)
        
        return cv_data
    
    def _extract_entities(self, text: str, cv_data: Dict, bbox: List[float]):
        """
        Extract entities from text using simple rules.
        
        Args:
            text: Text to parse
            cv_data: CV data dictionary to update
            bbox: Bounding box of the text
        """
        text_lower = text.lower()
        
        # Extract personal info patterns
        if any(keyword in text_lower for keyword in ['@', 'email', 'phone', 'tel:', 'mobile']):
            cv_data["personal_info"]["contact"] = cv_data["personal_info"].get("contact", []) + [text]
        
        # Extract experience patterns
        experience_keywords = ['experience', 'work', 'employment', 'career']
        if any(keyword in text_lower for keyword in experience_keywords):
            # Simple pattern: assume lines with dates are experience entries
            if any(month in text_lower for month in ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                                                    'jul', 'aug', 'sep', 'oct', 'nov', 'dec']):
                cv_data["experience"].append({
                    "text": text,
                    "bbox": bbox
                })
        
        # Extract education patterns
        education_keywords = ['education', 'degree', 'university', 'college', 'bachelor', 'master', 'phd']
        if any(keyword in text_lower for keyword in education_keywords):
            cv_data["education"].append({
                "text": text,
                "bbox": bbox
            })
        
        # Extract skills
        skills_keywords = ['skills', 'technologies', 'programming', 'languages', 'frameworks']
        if any(keyword in text_lower for keyword in skills_keywords):
            cv_data["skills"].append({
                "text": text,
                "bbox": bbox
            })
        
        # Extract certifications
        cert_keywords = ['certification', 'certified', 'license', 'qualification']
        if any(keyword in text_lower for keyword in cert_keywords):
            cv_data["certifications"].append({
                "text": text,
                "bbox": bbox
            })

def main():
    """Command-line interface for CV parser OCR pipeline."""
    parser = argparse.ArgumentParser(
        description="Parse CV PDFs using OCR and extract structured information"
    )
    
    parser.add_argument(
        "input_pdf",
        help="Path to input PDF file"
    )
    
    parser.add_argument(
        "--output-dir",
        default="cv_parser_output",
        help="Directory for output files (default: cv_parser_output)"
    )
    
    parser.add_argument(
        "--json-output",
        help="Path for JSON output file (default: <output_dir>/results/<pdf_stem>_parsed.json)"
    )
    
    parser.add_argument(
        "--dpi",
        type=int,
        default=300,
        help="DPI for PDF to image conversion (default: 300)"
    )
    
    parser.add_argument(
        "--model-path",
        help="Path to trained LayoutLMv3 model (optional)"
    )
    
    parser.add_argument(
        "--keep-intermediate",
        action="store_true",
        help="Keep intermediate files (images, OCR JSON)"
    )
    
    args = parser.parse_args()
    
    # Validate input
    pdf_path = Path(args.input_pdf)
    if not pdf_path.exists():
        log.error(f"PDF file not found: {pdf_path}")
        sys.exit(1)
    
    # Set up output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Initialize parser
        parser_ocr = CVParserOCR(model_path=Path(args.model_path) if args.model_path else None)
        
        # Process PDF
        result = parser_ocr.process_pdf(pdf_path, output_dir, dpi=args.dpi)
        
        # Save to specified JSON file if provided
        if args.json_output:
            json_path = Path(args.json_output)
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            log.info(f"Results also saved to: {json_path}")
        
        # Clean up intermediate files if requested
        if not args.keep_intermediate:
            # Optional: implement cleanup logic
            pass
        
        # Print summary
        print("\n=== CV PARSING SUMMARY ===")
        print(f"Personal Info: {len(result.get('personal_info', {}))} items")
        print(f"Experience: {len(result.get('experience', []))} entries")
        print(f"Education: {len(result.get('education', []))} entries")
        print(f"Skills: {len(result.get('skills', []))} items")
        print(f"Certifications: {len(result.get('certifications', []))} items")
        
    except Exception as e:
        log.error(f"CV parsing failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()