from paddleocr import PaddleOCR

ocr = PaddleOCR(
    use_textline_orientation=True,
    lang='en',
    ocr_version='PP-OCRv5'
)

results = ocr.predict("fixtures/cvpng.pdf")

for page_idx, page in enumerate(results):
    print(f"\n=== Page {page_idx+1} ===")
    print(f"Page type: {type(page)}")
    print(f"Page content: {page}")
    if not page:
        print("No text detected.")
    else:
        for idx, line in enumerate(page):
            print(f"Line {idx}: {line}")
            print(f"Line type: {type(line)}")
            if isinstance(line, (list, tuple)):
                print(f"Line length: {len(line)}")
                for i, item in enumerate(line):
                    print(f"  Item {i}: {item} (type: {type(item)})")