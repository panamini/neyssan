#!/usr/bin/env python3
"""
Minimal overfit sanity test for spaCy 3.7.2 transformer NER pipeline.
Fixes the "dictionary update sequence element #0 has length 5; 2 is required" error.
"""

import random
import spacy
from spacy.tokens import DocBin
from spacy.training import Example
from spacy.util import load_config, load_model_from_config

def main():
    print("🔧 Loading config and data...")
    
    # Load config
    CFG = "cv_parser/config_roberta_fixed.cfg"
    cfg = load_config(CFG, interpolate=True)
    
    # Load data
    db = DocBin().from_disk("my-app/testdata/cv_filtered/train.spacy")
    nlp_blank = spacy.blank("en")
    docs = list(db.get_docs(nlp_blank.vocab))
    
    # Create small subset for overfit test
    random.seed(42)
    subset = random.sample(docs, 10)
    print(f"📊 Using {len(subset)} documents for overfit test")
    
    # Build model
    nlp = load_model_from_config(cfg, auto_fill=True, validate=True)
    
    # CRITICAL FIX: Use correct Example format for transition-based parser
    # Transition-based parser expects Example(gold_doc, pred_doc) NOT Example.from_dict()
    def get_examples():
        examples = []
        for gold_doc in subset:
            # Create prediction doc with same text
            pred_doc = nlp.make_doc(gold_doc.text)
            # Use the gold_doc directly (it already has entities set)
            examples.append(Example(pred_doc, gold_doc))
        return examples
    
    print("🔧 Initializing pipeline...")
    
    # This should NOT fail with the dictionary error
    optimizer = nlp.initialize(get_examples)
    print("✅ Initialization successful!")
    
    # Train for 300 steps with evaluation
    print("🚀 Starting training (300 steps)...")
    
    for step in range(1, 301):
        # Shuffle examples each epoch
        examples = get_examples()
        random.shuffle(examples)
        
        # Update with single example (overfit aggressively)
        losses = {}
        nlp.update(examples, sgd=optimizer, losses=losses, drop=0.1)
        
        if step % 50 == 0:
            # Evaluate on the same subset
            scores = nlp.evaluate(examples)
            f1 = scores.get("ents_f", 0.0)
            print(f"Step {step:3d} | F1: {f1:.3f} | Losses: {losses}")
            
            # Test prediction on first doc
            test_doc = examples[0].reference
            pred_doc = nlp(test_doc.text)
            pred_ents = [(ent.text, ent.label_) for ent in pred_doc.ents]
            gold_ents = [(ent.text, ent.label_) for ent in test_doc.ents]
            print(f"   Predicted: {pred_ents[:3]}...")
            print(f"   Gold:      {gold_ents[:3]}...")
    
    print("✅ Training completed!")
    
    # Final evaluation
    examples = get_examples()
    scores = nlp.evaluate(examples)
    print(f"\n🎯 Final Results:")
    print(f"F1: {scores.get('ents_f', 0.0):.3f}")
    print(f"P:   {scores.get('ents_p', 0.0):.3f}")
    print(f"R:   {scores.get('ents_r', 0.0):.3f}")
    
    # Verify labels are loaded correctly
    ner = nlp.get_pipe("ner")
    print(f"📋 NER labels: {ner.labels}")
    
    # Save model
    output_path = "training/sanity_test_model"
    nlp.to_disk(output_path)
    print(f"💾 Model saved to: {output_path}")

if __name__ == "__main__":
    main()