from cv_parser.pipeline.hybrid_mapping import apply_hybrid_mapping
from cv_parser.schema.model import LayoutBlock, NormalizedCv, ContactInfo


def test_apply_hybrid_mapping_populates_fields():
    normalized = NormalizedCv(contact=ContactInfo())
    packed = {
      "sections": [
          {"label": "EXPERIENCE", "text": "Company A - Engineer"},
          {"label": "EDUCATION", "text": "University B"},
          {"label": "SKILLS", "text": "Python"},
          {"label": "LANGUAGES", "text": "English"},
      ],
      "entities": {
          "EMAIL": [{"value": "alice@example.com"}],
          "PHONE": [{"value": "+123456789"}],
          "NAME": [{"value": "Alice"}],
      },
    }

    strict, hybrid_used, counts = apply_hybrid_mapping(normalized, packed)

    assert normalized.experience
    assert normalized.education
    assert normalized.skills and "Python" in normalized.skills.text
    assert normalized.languages and "English" in normalized.languages.text
    assert normalized.contact.email == "alice@example.com"
    assert normalized.contact.phone == "+123456789"
    assert normalized.name == "Alice"
    assert strict and strict.email == "alice@example.com"
    assert hybrid_used is True
    assert counts.get("EXPERIENCE") == 1


def test_apply_hybrid_mapping_pp_structure_groups():
    normalized = NormalizedCv(contact=ContactInfo())
    packed = {"sections": [], "entities": {}}
    blocks = [
        LayoutBlock(page=1, text="Experience", bbox=[0, 0, 100, 10], block_type="title"),
        LayoutBlock(page=1, text="Acme Corp - Engineer", bbox=[0, 10, 200, 40], block_type="paragraph"),
        LayoutBlock(page=1, text="Education", bbox=[0, 50, 100, 60], block_type="title"),
        LayoutBlock(page=1, text="University B", bbox=[0, 60, 200, 90], block_type="paragraph"),
    ]

    strict, hybrid_used, counts = apply_hybrid_mapping(normalized, packed, blocks)

    assert normalized.experience and normalized.experience[0].content.startswith("Acme")
    assert normalized.education and normalized.education[0].content.startswith("University")
    assert getattr(normalized, "_pp_structure_used", False) is True
    assert counts.get("EXPERIENCE") == 1
    assert counts.get("EDUCATION") == 1
    assert hybrid_used is False


def test_apply_hybrid_mapping_pp_structure_no_titles():
    normalized = NormalizedCv(contact=ContactInfo())
    packed = {"sections": [], "entities": {}}
    blocks = [
        LayoutBlock(page=1, text="Random text", bbox=[0, 0, 100, 10], block_type="paragraph"),
    ]

    _, _, counts = apply_hybrid_mapping(normalized, packed, blocks)

    assert not getattr(normalized, "_pp_structure_used", False)
    assert counts == {}
