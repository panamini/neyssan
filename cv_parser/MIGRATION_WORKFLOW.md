# SpanCat Migration Workflow for CV Parser

Complete migration guide from transition-based NER to Transformer + SpanCat architecture.

## Overview

This migration addresses the critical "dictionary update sequence element #0 has length N; 2 is required" error in spaCy 3.7.2 by switching from problematic transition-based NER to SpanCat, which is better suited for messy CV data with overlapping spans.

## Migration Steps

### 1. Data Conversion

Convert existing NER entities to spans format:

```bash
# Convert training data
python cv_parser/scripts/ents_to_spans.py \
  my-app/testdata/cv_filtered/train.spacy \
  my-app/testdata/cv_filtered/train_spans.spacy \
  --spans-key sc

# Convert development data  
python cv_parser/scripts/ents_to_spans.py \
  my-app/testdata/cv_filtered/dev.spacy \
  my-app/testdata/cv_filtered/dev_spans.spacy \
  --spans-key sc
```

**Expected Output:**
- Train: 2,368 docs → spans with label distribution
- Dev: 142 docs → spans with label distribution
- Script exits with error if zero spans detected

### 2. Configuration Validation

Validate the converted data and configuration:

```bash
# Validate config and data
python -m spacy debug data cv_parser/config_spancat_roberta.cfg

# Run comprehensive verification
python cv_parser/scripts/verify_spancat.py
```

**Success Criteria:**
- Debug data shows nonzero gold spans for all 10 labels
- Verification script shows proper label distribution
- No validation errors or warnings

### 3. Probe Training (150 steps)

Run initial training to verify learning capability:

```bash
python -m spacy train cv_parser/config_spancat_roberta.cfg \
  --output training/out_spancat_probe \
  --training.max_steps 150 \
  --training.eval_frequency 25
```

**Success Criteria:**
- Training starts without initialization errors
- Loss decreases over first 50 steps
- Dev precision ≥ 0.30 by step 100
- No NaN or divergence in metrics

### 4. Stable Training (450 steps)

Run full training for production model:

```bash
python -m spacy train cv_parser/config_spancat_roberta.cfg \
  --output training/out_spancat_450 \
  --training.max_steps 450
```

**Success Criteria:**
- Improved F1 score vs probe training
- Stable convergence without overfitting
- Model loads and predicts correctly

### 5. Model Verification

Verify the trained model:

```bash
python cv_parser/scripts/verify_spancat.py
```

**Expected Results:**
- Model loads without errors
- Pipeline shows `['transformer', 'spancat']`
- SpanCat labels correctly initialized
- Predictions on sample CV text return reasonable spans

## Configuration Details

### Key Changes from Transition-Based NER

| Aspect | Transition-Based NER | SpanCat |
|--------|---------------------|---------|
| Architecture | `spacy.TransitionBasedParser.v2` | `spacy.SpanCategorizer.v2` |
| Data Format | `doc.ents` | `doc.spans["sc"]` |
| Overlap Handling | No | Yes (`allow_overlap = true`) |
| Label Init | From examples | Explicit labels in config |
| Memory Usage | Lower | Higher (larger batches) |

### Optimized Settings for CV Data

- **Transformer**: RoBERTa-base with window=192, stride=128
- **Batch Size**: 16 with accumulation=2 for stability
- **Learning Rate**: 3e-5 with 30-step warmup
- **SpanCat**: Allow overlap, threshold=0.5
- **Memory**: max_batch_items=256 to prevent OOM

## Error Recovery

### Common Issues and Solutions

**Issue**: "No spans found in training data"
- **Cause**: Conversion script failed or wrong spans_key
- **Fix**: Verify conversion script output and config spans_key match

**Issue**: "Labels for component 'spancat' not initialized"
- **Cause**: Missing or incorrect label initialization
- **Fix**: Check `[initialize.components.spancat]` section

**Issue**: Memory errors during training
- **Cause**: Transformer batches too large
- **Fix**: Reduce `max_batch_items` to 128 or lower

**Issue**: Zero F1 scores
- **Cause**: Data mismatch or incorrect span boundaries
- **Fix**: Run verification script to debug data quality

## Performance Expectations

### Baseline Metrics (from original NER)
- Train: 2,368 docs, 12,764 entities
- Dev: 142 docs, 2,682 entities
- Labels: 10 categories (SKILL, ROLE, COMPANY, etc.)

### Expected SpanCat Performance
- **Probe (150 steps)**: F1 ~0.40-0.60
- **Stable (450 steps)**: F1 ~0.65-0.80
- **Inference**: ~100-200ms per CV document

## Files Created

### Scripts
- [`ents_to_spans.py`](cv_parser/scripts/ents_to_spans.py) - Data conversion
- [`verify_spancat.py`](cv_parser/scripts/verify_spancat.py) - Model verification

### Configurations
- [`config_spancat_roberta.cfg`](cv_parser/config_spancat_roberta.cfg) - Optimized SpanCat config

### Output Directories
- `training/out_spancat_probe/` - Probe training results
- `training/out_spancat_450/` - Full training results

## Validation Checklist

- [ ] Data conversion completes without errors
- [ ] `spacy debug data` shows nonzero spans for all labels
- [ ] Verification script passes all checks
- [ ] Probe training converges (loss decreases)
- [ ] Stable training improves over probe
- [ ] Model loads and predicts on sample CV text
- [ ] All 10 label categories are recognized

## Rollback Procedure

If SpanCat migration fails, revert to transition-based NER:

1. Use original NER data files
2. Use [`config_roberta_fixed.cfg`](cv_parser/config_roberta_fixed.cfg)
3. Follow original training procedure

## Next Steps After Migration

1. **Evaluation**: Run comprehensive evaluation on test set
2. **Optimization**: Fine-tune hyperparameters for specific CV domains
3. **Integration**: Update inference pipeline to use SpanCat model
4. **Monitoring**: Set up performance monitoring and retraining pipeline

## Technical Notes

### Why SpanCat is Better for CV Data

1. **Overlapping Spans**: CVs often have nested entities (e.g., "Senior Software Engineer at Google" contains both ROLE and COMPANY)
2. **Table-like Structure**: CV sections create natural span boundaries
3. **Transformer Context**: Better understanding of long-range dependencies in career histories
4. **Error Resilience**: More robust to minor boundary inaccuracies

### Compatibility Matrix

| Component | spaCy 3.7.2 | Notes |
|-----------|-------------|-------|
| SpanCategorizer.v2 | ✅ | Recommended architecture |
| TransformerListener.v1 | ✅ | Proper gradient sharing |
| RoBERTa-base | ✅ | Optimal for English CVs |
| reduce_mean pooling | ✅ | Standard for transformer outputs |