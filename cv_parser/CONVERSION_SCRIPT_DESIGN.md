# Conversion Script Design: ents_to_spans.py

## 📋 Script Architecture

### Core Functionality
```python
def convert_ents_to_spans(input_path: str, output_path: str, spans_key: str = "sc"):
    """
    Convert doc.ents to doc.spans[spans_key] and clear doc.ents
    """
    # 1. Load input DocBin
    # 2. For each Doc: convert ents to spans
    # 3. Save to output DocBin
```

### Data Flow
```
Input: train.spacy (doc.ents) → Processing → Output: train_spans.spacy (doc.spans["sc"])
```

## 🔧 Technical Implementation

### Key Components

#### 1. DocBin Loading/Processing
```python
def load_and_convert_docs(input_path: str, spans_key: str) -> List[Doc]:
    """Load DocBin and convert ents to spans"""
    db = DocBin().from_disk(input_path)
    nlp = spacy.blank("en")
    docs = list(db.get_docs(nlp.vocab))
    
    converted_docs = []
    for doc in docs:
        # Convert ents to spans
        spans = []
        for ent in doc.ents:
            span = Span(doc, ent.start, ent.end, label=ent.label_)
            spans.append(span)
        
        # Create new doc with spans
        new_doc = Doc(
            vocab=doc.vocab,
            words=[token.text for token in doc],
            spaces=[bool(token.whitespace_) for token in doc]
        )
        new_doc.spans[spans_key] = spans
        # Clear ents: new_doc.ents = ()
        
        converted_docs.append(new_doc)
    
    return converted_docs
```

#### 2. Validation & Logging
```python
def validate_conversion(docs: List[Doc], spans_key: str) -> Dict[str, int]:
    """Validate conversion and return span counts per label"""
    label_counts = {}
    for doc in docs:
        spans = doc.spans.get(spans_key, [])
        for span in spans:
            label_counts[span.label_] = label_counts.get(span.label_, 0) + 1
    return label_counts
```

#### 3. CLI Interface
```python
@click.command()
@click.argument('input_path', type=click.Path(exists=True))
@click.argument('output_path', type=click.Path())
@click.argument('spans_key', default='sc')
def main(input_path, output_path, spans_key):
    """Convert NER entities to spans format"""
    # Conversion logic with progress reporting
```

## 🎯 Critical Design Decisions

### 1. Span Creation Approach
**Option A: Direct span assignment** (Recommended)
```python
doc.spans[spans_key] = [Span(doc, ent.start, ent.end, ent.label_) for ent in doc.ents]
doc.ents = ()  # Clear ents
```

**Option B: Copy doc and reassign** (More robust)
```python
new_doc = Doc(vocab=doc.vocab, words=[t.text for t in doc], spaces=[bool(t.whitespace_) for t in doc])
new_doc.spans[spans_key] = spans
```

**Decision**: Use Option B for better data integrity.

### 2. Error Handling
```python
try:
    # Conversion logic
except Exception as e:
    logging.error(f"Failed to convert {input_path}: {e}")
    sys.exit(1)
```

### 3. Progress Reporting
```python
for i, doc in enumerate(docs):
    if i % 100 == 0:
        print(f"Processed {i}/{len(docs)} documents")
```

## 📊 Expected Output

### Conversion Statistics
```
✅ Conversion completed:
- Input: 2368 documents, 12,764 entities
- Output: 2368 documents, 12,764 spans
- Labels: SKILL (2450), COMPANY (1980), ROLE (1850), ...
```

### File Structure
```
my-app/testdata/cv_filtered/
├── train.spacy (original)
├── dev.spacy (original)
├── train_spans.spacy (converted)
└── dev_spans.spacy (converted)
```

## 🧪 Validation Criteria

### 1. Data Integrity
- ✅ All entities converted to spans
- ✅ Span boundaries match entity boundaries
- ✅ Labels preserved correctly
- ✅ Document text unchanged

### 2. Format Compliance
- ✅ `doc.spans["sc"]` contains all spans
- ✅ `doc.ents` is empty
- ✅ DocBin serialization works correctly

### 3. Performance
- ✅ Handles 2,368 documents efficiently
- ✅ Memory usage stays reasonable
- ✅ Progress reporting every 100 docs

## 🔍 Edge Cases Handled

### 1. Empty Documents
```python
if not doc.ents:
    # Still create doc with empty spans
    doc.spans[spans_key] = []
```

### 2. Invalid Spans
```python
# Validate span boundaries
if ent.start >= len(doc) or ent.end > len(doc):
    logging.warning(f"Invalid entity boundaries in doc: {ent}")
    continue
```

### 3. Duplicate Spans
```python
# Remove duplicates by (start, end, label)
unique_spans = set((span.start, span.end, span.label_) for span in spans)
```

## 🚀 Implementation Sequence

### Phase 1: Core Conversion (MVP)
```python
# Basic conversion without advanced features
def simple_conversion(input_path, output_path, spans_key):
    # Load, convert, save
```

### Phase 2: Enhanced Features
```python
# Add validation, logging, progress reporting
def enhanced_conversion(input_path, output_path, spans_key):
    # With error handling and statistics
```

### Phase 3: Production Ready
```python
# Full CLI with options and robust error handling
@click.command()
def production_conversion():
    # Complete implementation
```

## 📋 Acceptance Tests

### Test 1: Basic Conversion
```bash
python cv_parser/scripts/ents_to_spans.py \
  my-app/testdata/cv_filtered/train.spacy \
  test_output.spacy sc
```

### Test 2: Verify Output
```python
# Load converted file and check spans
db = DocBin().from_disk("test_output.spacy")
docs = list(db.get_docs(spacy.blank("en").vocab))
assert len(docs[0].spans["sc"]) > 0
assert len(docs[0].ents) == 0
```

### Test 3: Label Preservation
```python
# Ensure all labels are preserved
original_labels = set(ent.label_ for doc in original_docs for ent in doc.ents)
converted_labels = set(span.label_ for doc in converted_docs for span in doc.spans["sc"])
assert original_labels == converted_labels
```

Ready to proceed with implementation based on this design?