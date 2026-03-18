#!/usr/bin/env python3
"""
Full Pipeline Runner for CV Parser

This script provides a unified interface for running the complete CV parsing pipeline,
including OCR, SpaCy, and hybrid modes with comprehensive configuration options.
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
from cv_parser.spacy_pipeline import SpacyCVParser

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
log = logging.getLogger(__name__)
log.warning("full_pipeline_runner.py is legacy; prefer 'python -m cv_parser.pipeline.runner' for structured extraction")

# Import available parsers
try:
    from cv_parser.spacy_pipeline import SpacyCVParser
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False
    log.warning("SpaCy parser not available")

try:
    from cv_parser.ocr.src.cli import CVParserOCR
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    log.warning("OCR pipeline not available")

try:
    from cv_parser.ocr_hybrid_pipeline import HybridCVParser
    HYBRID_AVAILABLE = True
except ImportError:
    HYBRID_AVAILABLE = False
    log.warning("Hybrid pipeline not available")


class FullPipelineRunner:
    """Main runner for the complete CV parsing pipeline."""
    
    def __init__(self, config: Optional[Dict] = None):
        """
        Initialize the pipeline runner.
        
        Args:
            config: Configuration dictionary for pipeline settings
        """
        self.config = config or {}
        self.parsers = {}
        
        # Initialize available parsers
        if SPACY_AVAILABLE:
            spacy_model = self.config.get('spacy_model_path')
            self.parsers['spacy'] = SpacyCVParser(spacy_model)
        
        if OCR_AVAILABLE:
            ocr_model = self.config.get('ocr_model_path')
            self.parsers['ocr'] = CVParserOCR(model_path=Path(ocr_model) if ocr_model else None)
        
        if HYBRID_AVAILABLE and SPACY_AVAILABLE and OCR_AVAILABLE:
            spacy_model = self.config.get('spacy_model_path')
            ocr_model = self.config.get('ocr_model_path')
            if spacy_model:
                self.parsers['hybrid'] = HybridCVParser(
                    spacy_model_path=spacy_model,
                    ocr_model_path=ocr_model
                )
    
    def run_pipeline(self,
                    input_path: Path,
                    output_dir: Path,
                    mode: str = 'auto',
                    dpi: int = 300,
                    keep_intermediate: bool = False) -> Dict[str, Any]:
        """
        Run the complete CV parsing pipeline.
        
        Args:
            input_path: Path to input file (PDF or text)
            output_dir: Directory for output files
            mode: Processing mode ('auto', 'spacy', 'ocr', 'hybrid')
            dpi: DPI for PDF conversion
            keep_intermediate: Keep intermediate files
            
        Returns:
            Combined parsing results
        """
        output_dir.mkdir(parents=True, exist_ok=True)

        if keep_intermediate:
            log.info("Keeping intermediate files enabled.")
        
        # Determine processing mode
        if mode == 'auto':
            mode = self._detect_best_mode(input_path)
        
        log.info(f"Running pipeline in {mode} mode for: {input_path}")
        
        # Process based on mode
        if mode == 'spacy' and 'spacy' in self.parsers:
            result = self._run_spacy_pipeline(input_path, output_dir)
        elif mode == 'ocr' and 'ocr' in self.parsers:
            result = self._run_ocr_pipeline(input_path, output_dir, dpi)
        elif mode == 'hybrid' and 'hybrid' in self.parsers:
            result = self._run_hybrid_pipeline(input_path, output_dir, dpi)
        else:
            raise ValueError(f"Unsupported mode: {mode} or parser not available")
        
        # Save results
        self._save_results(result, input_path, output_dir, mode)
        
        return result
    
    def _detect_best_mode(self, input_path: Path) -> str:
        """Detect the best processing mode based on input file."""
        if input_path.suffix.lower() == '.pdf':
            # For PDFs, use hybrid if available, else OCR
            if 'hybrid' in self.parsers:
                return 'hybrid'
            elif 'ocr' in self.parsers:
                return 'ocr'
            elif 'spacy' in self.parsers:
                return 'spacy'
        else:
            # For text files, use SpaCy
            if 'spacy' in self.parsers:
                return 'spacy'
        
        # Fallback to available parser
        if self.parsers:
            return next(iter(self.parsers.keys()))
        
        raise RuntimeError("No parsers available")
    
    def _run_spacy_pipeline(self, input_path: Path, output_dir: Path) -> Dict[str, Any]:
        """Run SpaCy-only pipeline."""
        if input_path.suffix.lower() == '.pdf':
            return self.parsers['spacy'].parse_path(input_path)
        else:
            text = input_path.read_text(encoding='utf-8')
            return self.parsers['spacy'].parse_text(text)
    
    def _run_ocr_pipeline(self, input_path: Path, output_dir: Path, dpi: int) -> Dict[str, Any]:
        """Run OCR-only pipeline."""
        if input_path.suffix.lower() != '.pdf':
            raise ValueError("OCR pipeline only supports PDF files")
        
        ocr_output_dir = output_dir / "ocr"
        return self.parsers['ocr'].process_pdf(input_path, ocr_output_dir, dpi=dpi)
    
    def _run_hybrid_pipeline(self, input_path: Path, output_dir: Path, dpi: int) -> Dict[str, Any]:
        """Run hybrid pipeline."""
        if input_path.suffix.lower() != '.pdf':
            raise ValueError("Hybrid pipeline only supports PDF files")
        
        hybrid_output_dir = output_dir / "hybrid"
        return self.parsers['hybrid'].parse_pdf(input_path, hybrid_output_dir)
    
    def _save_results(self, result: Dict, input_path: Path, output_dir: Path, mode: str):
        """Save parsing results to file."""
        # Save detailed JSON
        json_path = output_dir / f"{input_path.stem}_{mode}_results.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        # Save simplified summary
        summary_path = output_dir / f"{input_path.stem}_{mode}_summary.txt"
        self._save_summary(result, summary_path, mode)
        
        log.info(f"Results saved to: {json_path}")
        log.info(f"Summary saved to: {summary_path}")
    
    def _save_summary(self, result: Dict, summary_path: Path, mode: str):
        """Save human-readable summary."""
        with open(summary_path, 'w', encoding='utf-8') as f:
            f.write(f"CV PARSING SUMMARY ({mode.upper()} MODE)\n")
            f.write("=" * 50 + "\n\n")
            
            # Entity counts
            if 'entities' in result:
                f.write("ENTITIES FOUND:\n")
                entity_counts = {}
                for entity in result['entities']:
                    label = entity.get('label', 'UNKNOWN')
                    entity_counts[label] = entity_counts.get(label, 0) + 1
                
                for label, count in sorted(entity_counts.items()):
                    f.write(f"  {label}: {count}\n")
                f.write("\n")
            
            # Personal info (check if exists and has content)
            if result.get('personal_info'):
                f.write("PERSONAL INFORMATION:\n")
                for key, value in result['personal_info'].items():
                    if value:  # Only write if value is not empty
                        f.write(f"  {key}: {value}\n")
                f.write("\n")
            else:
                f.write("PERSONAL INFORMATION: Not found\n\n")
            
            # Experience
            if result.get('experience'):
                f.write(f"EXPERIENCE ENTRIES: {len(result['experience'])}\n")
                for i, exp in enumerate(result['experience'][:5]):  # Show first 5
                    exp_text = exp.get('text', '')
                    if exp_text:
                        f.write(f"  {i+1}. {exp_text[:100]}...\n")
                if len(result['experience']) > 5:
                    f.write(f"  ... and {len(result['experience']) - 5} more\n")
                f.write("\n")
            else:
                f.write("EXPERIENCE: No entries found\n\n")
            
            # Skills
            if result.get('skills'):
                f.write(f"SKILLS: {len(result['skills'])}\n")
                for i, skill in enumerate(result['skills'][:10]):  # Show first 10
                    skill_text = skill.get('text', '')
                    if skill_text:
                        f.write(f"  {skill_text}\n")
                if len(result['skills']) > 10:
                    f.write(f"  ... and {len(result['skills']) - 10} more\n")
                f.write("\n")
            else:
                f.write("SKILLS: No skills found\n\n")
            
            # Confidence scores
            if result.get('confidence_scores'):
                f.write("CONFIDENCE SCORES:\n")
                for label, score in result['confidence_scores'].items():
                    f.write(f"  {label}: {score:.2f}\n")
            else:
                f.write("CONFIDENCE SCORES: Not available\n")
    
    def batch_process(self, 
                     input_dir: Path, 
                     output_dir: Path,
                     file_pattern: str = "*.pdf",
                     mode: str = 'auto',
                     dpi: int = 300) -> List[Dict[str, Any]]:
        """
        Process multiple files in batch mode.
        
        Args:
            input_dir: Directory containing input files
            output_dir: Directory for output files
            file_pattern: File pattern to match (e.g., "*.pdf")
            mode: Processing mode
            dpi: DPI for PDF conversion
            
        Returns:
            List of processing results
        """
        input_files = list(input_dir.glob(file_pattern))
        results = []
        
        log.info(f"Processing {len(input_files)} files in batch mode")
        
        for i, input_file in enumerate(input_files):
            log.info(f"Processing file {i+1}/{len(input_files)}: {input_file.name}")
            
            try:
                file_output_dir = output_dir / input_file.stem
                result = self.run_pipeline(input_file, file_output_dir, mode, dpi)
                result['file_name'] = input_file.name
                result['status'] = 'success'
                results.append(result)
                
            except Exception as e:
                log.error(f"Failed to process {input_file.name}: {e}")
                results.append({
                    'file_name': input_file.name,
                    'status': 'error',
                    'error': str(e)
                })
        
        # Save batch summary
        self._save_batch_summary(results, output_dir)
        
        return results
    
    def _save_batch_summary(self, results: List[Dict], output_dir: Path):
        """Save batch processing summary."""
        summary = {
            'total_files': len(results),
            'successful': len([r for r in results if r.get('status') == 'success']),
            'failed': len([r for r in results if r.get('status') == 'error']),
            'files': results
        }
        
        summary_path = output_dir / "batch_summary.json"
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        
        log.info(f"Batch summary saved to: {summary_path}")


def main():
    """Command-line interface for the full pipeline runner."""
    parser = argparse.ArgumentParser(
        description="Full CV Parsing Pipeline Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process single PDF with auto mode
  python full_pipeline_runner.py resume.pdf --output-dir results
  
  # Process all PDFs in directory
  python full_pipeline_runner.py --input-dir resumes --output-dir results --batch
  
  # Force OCR mode for complex layout
  python full_pipeline_runner.py resume.pdf --mode ocr --dpi 400
        """
    )
    
    # Input options
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("input_path", nargs='?', help="Path to input file (PDF or text)")
    input_group.add_argument("--input-dir", help="Directory containing files for batch processing")
    
    # Output options
    parser.add_argument("--output-dir", required=True, help="Output directory")
    parser.add_argument("--mode", choices=['auto', 'spacy', 'ocr', 'hybrid'], 
                       default='auto', help="Processing mode (default: auto)")
    
    # Configuration
    parser.add_argument("--spacy-model", help="Path to SpaCy model")
    parser.add_argument("--ocr-model", help="Path to OCR model (LayoutLMv3)")
    parser.add_argument("--dpi", type=int, default=300, help="DPI for PDF conversion")
    
    # Batch processing
    parser.add_argument("--batch", action='store_true', help="Enable batch processing")
    parser.add_argument("--file-pattern", default="*.pdf", help="File pattern for batch processing")
    parser.add_argument("--keep-intermediate", action='store_true', 
                       help="Keep intermediate files")
    
    args = parser.parse_args()
    
    # Validate inputs
    if args.input_path and not Path(args.input_path).exists():
        log.error(f"Input file not found: {args.input_path}")
        sys.exit(1)
    
    if args.input_dir and not Path(args.input_dir).exists():
        log.error(f"Input directory not found: {args.input_dir}")
        sys.exit(1)
    
    # Create configuration
    config = {}
    if args.spacy_model:
        config['spacy_model_path'] = args.spacy_model
    if args.ocr_model:
        config['ocr_model_path'] = args.ocr_model
    
    # Initialize runner
    runner = FullPipelineRunner(config)
    
    try:
        if args.batch or args.input_dir:
            # Batch processing
            input_dir = Path(args.input_dir) if args.input_dir else Path(args.input_path).parent
            results = runner.batch_process(
                input_dir=input_dir,
                output_dir=Path(args.output_dir),
                file_pattern=args.file_pattern,
                mode=args.mode,
                dpi=args.dpi
            )
            
            log.info(f"Batch processing complete: {len([r for r in results if r['status'] == 'success'])} successful, "
                    f"{len([r for r in results if r['status'] == 'error'])} failed")
        
        else:
            # Single file processing
            result = runner.run_pipeline(
                input_path=Path(args.input_path),
                output_dir=Path(args.output_dir),
                mode=args.mode,
                dpi=args.dpi,
                keep_intermediate=args.keep_intermediate
            )
            
            log.info("Single file processing complete")
    
    except Exception as e:
        log.error(f"Pipeline execution failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
