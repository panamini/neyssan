from cv_parser.canonicalize import (
    canonicalize_cv,
    extract_sections,
    parse_education_block,
    parse_experience_block,
    strip_leading_markdown_heading,
)


def test_extract_sections_promotes_proven_fixture_headings() -> None:
    raw_text = """
    JOHN DOE

    PROFESSIONAL PROFILE
    Delivery-focused engineer with 8 years of experience leading cross-functional teams.

    PERSONAL EXPERIENCE
    Example Corp - Senior Engineer
    Built resilient internal tooling.

    ACADEMIC CREDENTIALS
    Bachelor of Engineering, Example University
    """

    sections = extract_sections(raw_text)

    assert sections["PROFILE"] == [
        "Delivery-focused engineer with 8 years of experience leading cross-functional teams."
    ]
    assert sections["EXPERIENCE"] == [
        "Example Corp - Senior Engineer\nBuilt resilient internal tooling."
    ]
    assert sections["EDUCATION"] == ["Bachelor of Engineering, Example University"]

    body_text = "\n".join(sections.get("BODY", []))
    assert "Delivery-focused engineer" not in body_text
    assert "Example Corp - Senior Engineer" not in body_text
    assert "Bachelor of Engineering" not in body_text


def test_canonicalize_cv_emits_typed_raw_sections_for_promoted_headings() -> None:
    raw_text = """
    JOHN DOE

    PROFESSIONAL PROFILE
    Delivery-focused engineer with 8 years of experience leading cross-functional teams.

    PERSONAL EXPERIENCE
    Example Corp - Senior Engineer
    Built resilient internal tooling.

    ACADEMIC CREDENTIALS
    Bachelor of Engineering, Example University
    """

    payload = canonicalize_cv(raw_text, mode="text", diagnostics={"route": "pdf_has_text"})

    labels = [section["label"] for section in payload["rawSections"]]
    assert "PROFILE" in labels
    assert "EXPERIENCE" in labels
    assert "EDUCATION" in labels

    body_text = "\n".join(
        section["content"] for section in payload["rawSections"] if section["label"] == "BODY"
    )
    assert "Delivery-focused engineer" not in body_text
    assert "Example Corp - Senior Engineer" not in body_text
    assert "Bachelor of Engineering" not in body_text

    normalized = payload["normalized"]
    assert normalized["summary"]["text"]
    assert normalized["experience"]
    assert normalized["education"]


def test_extract_sections_promotes_professional_skills_and_education_background() -> None:
    raw_text = """
    JANE DOE

    PROFESSIONAL SKILLS
    Good communication, interpersonal and problem solving skills
    Leadership and stakeholder management

    EDUCATION BACKGROUND
    Bachelor of Science, Example College
    """

    sections = extract_sections(raw_text)

    assert sections["SKILLS"] == [
        "Good communication, interpersonal and problem solving skills\nLeadership and stakeholder management"
    ]
    assert sections["EDUCATION"] == ["Bachelor of Science, Example College"]

    body_text = "\n".join(sections.get("BODY", []))
    assert "Good communication" not in body_text
    assert "Bachelor of Science" not in body_text


def test_canonicalize_cv_emits_typed_raw_sections_for_skills_and_education_background() -> None:
    raw_text = """
    JANE DOE

    PROFESSIONAL SKILLS
    Good communication, interpersonal and problem solving skills
    Leadership and stakeholder management

    EDUCATION BACKGROUND
    Bachelor of Science, Example College
    """

    payload = canonicalize_cv(raw_text, mode="text", diagnostics={"route": "pdf_has_text"})

    labels = [section["label"] for section in payload["rawSections"]]
    assert "SKILLS" in labels
    assert "EDUCATION" in labels

    body_text = "\n".join(
        section["content"] for section in payload["rawSections"] if section["label"] == "BODY"
    )
    assert "Good communication" not in body_text
    assert "Bachelor of Science" not in body_text

    normalized = payload["normalized"]
    assert normalized["skills"]
    assert normalized["education"]


def test_canonicalize_cv_routes_personal_dossier_to_additional_information_raw_section() -> None:
    raw_text = """
    JANE DOE

    PERSONAL DOSSIER
    Address : 10 Example Street
    Date of Birth : 25/02/1983
    Gender : Female
    Marital Status : Single
    """

    payload = canonicalize_cv(raw_text, mode="text", diagnostics={"route": "pdf_has_text"})

    labels = [section["label"] for section in payload["rawSections"]]
    assert "ADDITIONAL INFORMATION" in labels

    body_text = "\n".join(
        section["content"] for section in payload["rawSections"] if section["label"] == "BODY"
    )
    assert "Date of Birth" not in body_text
    assert "Marital Status" not in body_text


def test_strip_leading_markdown_heading_is_narrow() -> None:
    assert strip_leading_markdown_heading("### Security Guard") == "Security Guard"
    assert strip_leading_markdown_heading("  ## Skills") == "Skills"
    assert strip_leading_markdown_heading("#") == ""
    assert strip_leading_markdown_heading("Badge #1234") == "Badge #1234"
    assert strip_leading_markdown_heading("Section #7 responsibilities") == "Section #7 responsibilities"


def test_extract_sections_strips_markdown_heading_markers_without_removing_inline_hashes() -> None:
    raw_text = """
    ROBERT COOPER
    #
    ### Security Guard
    SECURITY GUARD LOS ANGELES, CA 90291, UNITED STATES 3868683442

    # SUMMARY
    Safety conscious, attentive Security Guard with eight years experience.
    Badge #1234 handled all overnight checks.

    ### EXPERIENCE
    Security Guard at ADT Security, Port Washington
    Reduced unauthorized entry by 26%.
    """

    sections = extract_sections(raw_text)

    assert "SUMMARY" in sections
    assert "EXPERIENCE" in sections
    assert all("# SUMMARY" not in block for block in sections["SUMMARY"])
    assert all("###" not in block for block in sections["EXPERIENCE"])
    assert any("Badge #1234" in block for block in sections["SUMMARY"])

    body_text = "\n".join(sections.get("BODY", []))
    assert "### Security Guard" not in body_text
    assert "# SUMMARY" not in body_text
    assert "Badge #1234" not in body_text


def test_canonicalize_cv_drops_leaked_markdown_heading_markers_from_raw_sections() -> None:
    raw_text = """
    ROBERT COOPER
    #
    ### Security Guard
    SECURITY GUARD LOS ANGELES, CA 90291, UNITED STATES 3868683442

    # SUMMARY
    Safety conscious, attentive Security Guard with eight years experience.
    Badge #1234 handled all overnight checks.

    ### EXPERIENCE
    Security Guard at ADT Security, Port Washington
    Reduced unauthorized entry by 26%.
    """

    payload = canonicalize_cv(raw_text, mode="text", diagnostics={"route": "external_ocr"})

    labels = [section["label"] for section in payload["rawSections"]]
    assert "SUMMARY" in labels
    assert "EXPERIENCE" in labels

    combined_raw = "\n".join(section["content"] for section in payload["rawSections"])
    assert "### Security Guard" not in combined_raw
    assert "# SUMMARY" not in combined_raw
    assert "### EXPERIENCE" not in combined_raw
    assert "Badge #1234" in combined_raw


def test_parse_experience_block_strips_markdown_heading_markers_from_position() -> None:
    block = """
    ### Security Guard
    ADT Security, Port Washington
    Badge #1234 handled all overnight checks.
    Reduced unauthorized entry by 26%.
    """

    entries = parse_experience_block(block)

    assert len(entries) == 1
    combined_structured = " ".join(
        str(entries[0].get(key) or "")
        for key in ["company", "position", "location", "responsibilities"]
    )
    assert "###" not in combined_structured
    assert "Security Guard" in combined_structured
    assert "Badge #1234" in str(entries[0]["responsibilities"])


def test_parse_education_block_strips_markdown_heading_markers_from_degree_titles() -> None:
    first = parse_education_block(
        """
        ### Certified Protection Guard Program (CPOP)
        ASIS International, North Naples
        """
    )
    second = parse_education_block(
        "### Security Guard Certificate Program (SOCP), Example Security Academy"
    )

    assert first is not None
    assert second is not None
    assert "###" not in str(first["degree"])
    assert "###" not in str(second["degree"])
    assert "Certified Protection Guard Program (CPOP)" in str(first["degree"])
    assert "Security Guard Certificate Program (SOCP)" in str(second["degree"])
