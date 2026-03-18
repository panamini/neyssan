from cv_parser.section_segmenter import SectionSegmenter
from cv_parser.types import LayoutBlock


def make_block(text: str, page: int = 1, column: int = 0, heading: bool = True, idx: int = 0):
    return LayoutBlock(
        page=page,
        block_id=f"b{idx}",
        text=text,
        bbox=(0.0, float(idx), 1.0, float(idx) + 1.0),
        column=column,
        heading=heading,
    )


def test_section_segmenter_aliases():
    blocks = [
        make_block("Biodata", idx=0),
        make_block("Jane Doe\nSenior Engineer", heading=False, idx=1),
        make_block("Academic Credentials", idx=2),
        make_block("MIT\nPhD Computer Science", heading=False, idx=3),
        make_block("Career Highlights", idx=4),
        make_block("Improved accuracy by 20%", heading=False, idx=5),
    ]

    sections = SectionSegmenter().segment(blocks)
    assert [section.label for section in sections] == ["SUMMARY", "EDUCATION", "ACHIEVEMENTS"]
    assert "Jane Doe" in sections[0].text
    assert "MIT" in sections[1].text

