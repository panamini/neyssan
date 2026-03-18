# spaCy 3.7.2 Transformer NER Pipeline Fix Guide

## Root Cause Analysis

The error "dictionary update sequence element #0 has length 5; 2 is required" occurs because **spaCy's transition-based parser expects a different example format** than what you're providing.

### Problem
- Using `Example.from_dict()` with character offsets for a transition-based parser
- Transition-based parsers require `Example(gold_doc, pred_doc)` format where `gold_doc` is a Doc object with entities already set

### Solution
- Use `Example(pred_doc, gold_doc)` instead of `Example.from_dict()`
- Ensure `gold_doc` already has entities set from the DocBin

## Fixed Files Created

### 1. Corrected Config File
- **File**: `cv_parser/config_roberta_fixed.cfg`
- **Changes**: 
  - Removed custom callbacks temporarily
  - Increased gradient factor to 1.0 for better flow
  - Enabled upper layer for better performance
  - Fixed example creation format

### 2. Minimal Overfit Sanity Script
- **File**: `cv_parser/scripts/train_sanity_fixed.py`
- **Purpose**: Test initialization and overfit on 10 documents
- **Key Fix**: Correct `Example(pred_doc, gold_doc)` format

### 3. Alternative SpanCat Config
- **File**: `cv_parser/config_spancat_roberta.cfg`
- **Purpose**: Better for messy, table-like CV data
- **Features**: Overlapping spans, multiple span sizes

### 4. Verification Script
- **File**: `cv_parser/scripts/verify_model.py`
- **Purpose**: Test model loading, labels, and predictions

## Exact Training Commands

### Option 1: Fixed Transition-Based NER (Recommended First Try)

```bash
# Test initialization and overfit (should NOT fail)
python cv_parser/scripts/train_sanity_fixed.py

# Full training with CLI
python -m spacy train cv_parser/config_roberta_fixed.cfg \
  --output training/out_fixed \
  --paths.train my-app/testdata/cv_filtered/train.spacy \
  --paths.dev my-app/testdata/cv_filtered/dev.spacy \
  --training.max_steps 300 \
  --training.eval_frequency 50
```

### Option 2: SpanCat Alternative (Better for CV Data)

```bash
# Convert NER to spancat format (if needed)
python -m spacy convert my-app/testdata/cv_filtered/train.spacy ./converted --converter spancat

# Train spancat model
python -m spacy train cv_parser/config_spancat_roberta.cfg \
  --output training/out_spancat \
  --paths.train my-app/testdata/cv_filtered/train.spacy \
  --paths.dev my-app/testdata/cv_filtered/dev.spacy \
  --training.max_steps 300
```

### Option 3: Python Script Training

```python
# Use the fixed training script
python cv_parser/scripts/train_sanity_gpu.py  # Updated to use fixed config
```

## Verification Steps

### 1. Test Initialization (Critical)
```bash
python cv_parser/scripts/train_sanity_fixed.py
```
**Expected**: Should complete without dictionary error, show F1 > 0.0 after 300 steps

### 2. Verify Model After Training
```bash
# Test the trained model
python cv_parser/scripts/verify_model.py training/sanity_test_model --test-data my-app/testdata/cv_filtered/dev.spacy

# For full training output
python cv_parser/scripts/verify_model.py training/out_fixed/model-last --test-data my-app/testdata/cv_filtered/dev.spacy
```

### 3. Check Labels Are Loaded
```python
import spacy
nlp = spacy.load("training/out_fixed/model-last")
print("NER labels:", nlp.get_pipe("ner").labels)
```

## Environment Setup

Ensure your environment matches:
```bash
python -c "import spacy; print(f'spaCy: {spacy.__version__}')"
python -c "import spacy_transformers; print('spacy-transformers: OK')"
python -c "import torch; print(f'PyTorch: {torch.__version__}')"
```

## Expected Results

### Successful Initialization
- No "dictionary update sequence" error
- Model initializes with correct labels
- F1 should be > 0.0 after 300 steps on overfit test

### Training Progression
- Step 50: F1 ≈ 0.1-0.3 (starting to learn)
- Step 150: F1 ≈ 0.5-0.7 (significant learning)
- Step 300: F1 ≈ 0.8-0.9 (overfitting on 10 docs)

## Troubleshooting

### If Still Failing
1. **Remove custom callbacks**: Comment out `python = ["cv_parser.training_callbacks"]` in config
2. **Check data format**: Ensure `.spacy` files contain valid Doc objects with entities
3. **Verify label consistency**: All labels in config must exist in training data

### Common Issues
- **Label mismatch**: Config labels don't match data labels
- **Memory issues**: Reduce batch size to 8 if OOM errors
- **Transformer download**: First run may download RoBERTa weights

## Next Steps After Fix

1. ✅ Run overfit test to confirm fix works
2. ✅ Train full model for 300 steps
3. ✅ Verify model predictions make sense
4. ✅ Scale to full dataset with proper hyperparameters

The key fix is using `Example(pred_doc, gold_doc)` instead of `Example.from_dict()` for transition-based parsers. This resolves the dictionary error and enables proper learning.