# spaCy 3.7.2 NER → SpanCat Migration Plan

## 🎯 Key Facts from Official References

1. **SpanCat trains from `doc.spans[KEY]`** (not `doc.ents`) and supports overlapping spans
2. **TransformerListener** reuses transformer outputs for downstream components  
3. **Validate with `spacy debug data`** before training to catch issues early
4. **DocBin** is the correct format for training data I/O
5. **SpanFinder** (optional) writes candidate spans to `doc.spans[KEY]`

## 📋 Step-by-Step Implementation Plan

### Phase 1: Data Conversion
- **Task 1**: Create `ents_to_spans.py` conversion script
- **Task 2**: Convert `train.spacy` and `dev.spacy` to spans format
- **Task 3**: Verify conversion with span counts per label

### Phase 2: Configuration
- **Task 4**: Fix `config_spancat_roberta.cfg` with proper SpanCat v1 architecture
- **Task 5**: Add label initialization for spancat component
- **Task 6**: Configure transformer with proper window/stride for CV data

### Phase 3: Validation & Testing
- **Task 7**: Create `verify_spancat.py` verification script
- **Task 8**: Run `spacy debug data` to validate config and data
- **Task 9**: Test data conversion and verify spans creation

### Phase 4: Training
- **Task 10**: Execute probe training (150 steps)
- **Task 11**: Execute stable training (450 steps)
- **Task 12**: Verify final model predictions

### Phase 5: Documentation
- **Task 13**: Update README.md with complete workflow
- **Task 14**: (Optional) Add SpanRuler/EntityRuler documentation

## 🚀 Immediate Next Steps

### 1. Create Conversion Script (`ents_to_spans.py`)
```python
# Converts doc.ents → doc.spans["sc"] and clears doc.ents
# Input: source.spacy, output: target.spacy, spans_key
# Uses DocBin I/O with proper logging
```

### 2. Convert Data Files
```bash
python cv_parser/scripts/ents_to_spans.py \
  my-app/testdata/cv_filtered/train.spacy my-app/testdata/cv_filtered/train_spans.spacy sc
  
python cv_parser/scripts/ents_to_spans.py \
  my-app/testdata/cv_filtered/dev.spacy my-app/testdata/cv_filtered/dev_spans.spacy sc
```

### 3. Validate with Debug Data
```bash
python -m spacy debug data cv_parser/config_spancat_roberta.cfg
```

## ⚙️ Technical Specifications

### Config Requirements
- Pipeline: `["transformer","spancat"]`
- `spancat.spans_key = "sc"`
- `allow_overlap = true` 
- Transformer: RoBERTa base, window=192, stride=128
- Training: batch_size=16, accumulate_gradient=2
- LR: initial_rate=2e-5, warmup_steps=30

### Acceptance Criteria
- ✅ Debug data shows nonzero gold spans for all labels
- ✅ Probe training: dev precision ≥ 0.30 by step 100
- ✅ Stable run: improved F1 vs probe
- ✅ Model loads and returns spans on CV text

## 🛠️ Troubleshooting Guide

### Memory Issues (MPS)
- Lower `max_batch_items` and `batch_size`
- Keep `accumulate_gradient=2`

### Zero Gold Spans
- Check conversion script ran correctly
- Verify `spans_key` matches in config

### Training Errors
- Ensure proper label initialization
- Check transformer model downloads correctly

## 📊 Expected Timeline

| Phase | Duration | Critical Path |
|-------|----------|---------------|
| Data Conversion | 15 min | ✅ Must complete first |
| Config Validation | 10 min | ✅ Blocking training |
| Probe Training | 30 min | ✅ Quick feedback |
| Stable Training | 60 min | ✅ Production ready |
| Documentation | 20 min | ✅ Future reference |

## 🎯 Success Metrics

- **Conversion**: 100% of entities converted to spans
- **Validation**: Debug data passes without errors  
- **Probe**: F1 > 0.0 within 50 steps
- **Stable**: F1 > 0.5 after 450 steps
- **Verification**: Model predicts sensible spans on CV text

Ready to proceed with implementation!
Minor Enhancements:

Consider lowering grad_factor from default 1.0 to 0.2–0.3 for more stable transformer fine-tuning on small datasets.

Add explicit note to clear doc.ents after conversion to avoid mixing spans and ents.

Mention saving converted files under a separate folder (e.g., train_spans.spacy) to keep original NER data safe.