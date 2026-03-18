from cv_parser.extract.bbox import normalize_bbox


def test_normalize_bbox_clamps_values():
    bbox = normalize_bbox((50, 100, 550, 700), page_width=600, page_height=800)
    assert bbox == [83, 125, 917, 875]
    assert all(0 <= value <= 1000 for value in bbox)
