#!/usr/bin/env python3
"""
Verification script for spaCy NER model.
Tests model loading, label verification, and prediction on sample documents.
"""

import spacy
from spacy.tokens import DocBin
import random

def verify_model(model_path, test_data_path=None, num_samples=3):
    """Verify a trained spaCy model works correctly."""
    
    print(f"🔍 Verifying model: {model_path}")
    
    try:
        # Load the model
        nlp = spacy.load(model_path)
        print("✅ Model loaded successfully")
        
        # Check pipeline components
        print(f"📦 Pipeline: {nlp.pipe_names}")
        
        # Check NER labels
        if "ner" in nlp.pipe_names:
            ner = nlp.get_pipe("ner")
            print(f"📋 NER labels: {ner.labels}")
            print(f"📊 Number of labels: {len(ner.labels)}")
        
        # Check spancat labels if present
        if "spancat" in nlp.pipe_names:
            spancat = nlp.get_pipe("spancat")
            print(f"📋 SpanCat categories: {spancat.labels}")
            print(f"📊 Number of categories: {len(spancat.labels)}")
        
        # Test prediction on sample text
        sample_texts = [
            "Python developer with 5 years experience at Google. Master's degree in Computer Science from MIT.",
            "Senior Software Engineer at Microsoft from 2020 to 2023. Skills include Java, Spring Boot, and AWS.",
            "Data Scientist with PhD in Statistics. Certified AWS Solutions Architect. Fluent in English and French."
        ]
        
        print("\n🧪 Testing predictions on sample texts:")
        for i, text in enumerate(sample_texts):
            doc = nlp(text)
            entities = [(ent.text, ent.label_) for ent in doc.ents]
            print(f"Sample {i+1}: {entities}")
        
        # Test on actual data if provided
        if test_data_path:
            print(f"\n📊 Testing on actual data: {test_data_path}")
            db = DocBin().from_disk(test_data_path)
            nlp_blank = spacy.blank("en")
            docs = list(db.get_docs(nlp_blank.vocab))
            
            # Sample a few documents
            random.seed(42)
            sample_docs = random.sample(docs, min(num_samples, len(docs)))
            
            for i, gold_doc in enumerate(sample_docs):
                pred_doc = nlp(gold_doc.text)
                pred_ents = [(ent.text, ent.label_) for ent in pred_doc.ents]
                gold_ents = [(ent.text, ent.label_) for ent in gold_doc.ents]
                
                print(f"\nDocument {i+1}:")
                print(f"  Predicted entities: {pred_ents[:5]}...")
                print(f"  Gold entities:      {gold_ents[:5]}...")
                print(f"  Text preview: {gold_doc.text[:100]}...")
        
        return True
        
    except Exception as e:
        print(f"❌ Model verification failed: {e}")
        return False

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Verify spaCy model")
    parser.add_argument("model_path", help="Path to the model directory")
    parser.add_argument("--test-data", help="Path to test data (.spacy file)")
    parser.add_argument("--samples", type=int, default=3, help="Number of samples to test")
    
    args = parser.parse_args()
    
    success = verify_model(args.model_path, args.test_data, args.samples)
    
    if success:
        print("\n🎉 Model verification completed successfully!")
    else:
        print("\n💥 Model verification failed!")
        exit(1)

if __name__ == "__main__":
    main()