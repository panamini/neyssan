#!/usr/bin/env python3
"""
Verify SpanCat model training and predictions on CV data.
"""

import random
import sys
from collections import Counter
from pathlib import Path

import spacy
from spacy.tokens import DocBin

def verify_data_conversion():
    """Verify that spans conversion worked correctly with streaming and fail-fast."""
    print("🔍 Verifying data conversion...")
    
    nlp = spacy.blank("en")
    train_path = Path("my-app/testdata/cv_filtered/train_spans.spacy")
    dev_path = Path("my-app/testdata/cv_filtered/dev_spans.spacy")
    
    if not train_path.exists() or not dev_path.exists():
        print("❌ Converted span files not found. Run conversion first.")
        sys.exit(1)
    
    # Stream docs to avoid memory issues
    train_db = DocBin().from_disk(str(train_path))
    dev_db = DocBin().from_disk(str(dev_path))
    
    train_docs = list(train_db.get_docs(nlp.vocab))
    dev_docs = list(dev_db.get_docs(nlp.vocab))
    
    print(f"📊 Train docs: {len(train_docs)}, Dev docs: {len(dev_docs)}")
    
    # Count all spans and fail fast if none found
    all_spans = [s for doc in train_docs for s in doc.spans.get("sc", [])]
    if not all_spans:
        print("❌ No spans found in training data — check conversion!")
        sys.exit(1)
    
    counts = Counter([s.label_ for s in all_spans])
    print(f"   Span counts: {dict(counts)}")
    
    # Set seed for reproducible sampling
    random.seed(42)
    
    # Check spans in random sample of docs
    sample_docs = random.sample(train_docs, min(3, len(train_docs)))
    for i, doc in enumerate(sample_docs):
        spans = doc.spans.get("sc", [])
        print(f"  Doc {i}: {len(spans)} spans")
        # Convert SpanGroup to list for slicing
        span_list = list(spans)
        for span in span_list[:3]:  # Show first 3 spans
            print(f"    - {span.label_}: '{span.text}'")

def verify_model_predictions(model_path):
    """Verify a trained model can load and predict."""
    print(f"🤖 Loading model from {model_path}...")
    
    try:
        nlp = spacy.load(model_path)
        print("✅ Model loaded successfully")
        print(f"   Pipeline: {nlp.pipe_names}")
        
        # Check if spancat component exists and has labels
        if "spancat" in nlp.pipe_names:
            spancat = nlp.get_pipe("spancat")
            print(f"   SpanCat labels: {spancat.labels}")
        else:
            print("❌ No spancat component found")
            
        # Test prediction on sample text
        test_text = "Python JavaScript React Senior Software Engineer at Google 2020-2023"
        doc = nlp(test_text)
        spans = doc.spans.get("sc", [])
        
        print(f"📝 Test prediction on: '{test_text}'")
        print(f"   Found {len(spans)} spans:")
        for span in spans:
            print(f"    - {span.label_}: '{span.text}' (score: {span.score:.3f})")
            
    except Exception as e:
        print(f"❌ Error loading model: {e}")

def verify_config():
    """Verify the config is valid with return code checking."""
    print("⚙️  Verifying config with spacy debug data...")
    
    import subprocess
    try:
        result = subprocess.run([
            "python", "-m", "spacy", "debug", "data",
            "cv_parser/config_spancat_roberta.cfg"
        ], capture_output=True, text=True, cwd=".")
        
        print(f"Exit code: {result.returncode}")
        if result.returncode != 0:
            print("❌ Config or data validation failed!")
            if result.stderr:
                print("Stderr:", result.stderr)
        else:
            print("✅ Config validation passed")
            
        print("Debug data output:")
        print(result.stdout)
            
    except Exception as e:
        print(f"❌ Error running debug data: {e}")

if __name__ == "__main__":
    print("🚀 SpanCat Verification Script")
    print("=" * 50)
    
    # Step 1: Verify data conversion
    verify_data_conversion()
    print()
    
    # Step 2: Verify config
    verify_config()
    print()
    
    # Step 3: Check for existing models
    model_dirs = [
        Path("training/out_spancat_probe"),
        Path("training/out_spancat_450")
    ]
    
    for model_dir in model_dirs:
        if model_dir.exists():
            print(f"🔍 Checking {model_dir}...")
            model_path = model_dir / "model-last"
            if model_path.exists():
                verify_model_predictions(str(model_path))
            else:
                print(f"   No model-last found in {model_dir}")
        else:
            print(f"   {model_dir} does not exist yet")
    
    print("✅ Verification complete")