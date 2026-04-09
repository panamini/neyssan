from cv_parser.canonicalize import (
    _trim_family_local_contamination,
    build_education_entries,
    build_language_entries,
    build_skill_entries,
    canonicalize_cv,
    extract_name_and_role,
    extract_education_markdown_table_region,
    extract_language_markdown_table_region,
    extract_sections,
    trim_skills_block,
    parse_experience_block,
    parse_education_block,
    split_experience_entries,
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


def test_split_experience_entries_keeps_robert_header_dates_and_bullets_in_one_chunk() -> None:
    block = """
    Security Guard at ADT Security, Port Washington
    January 2021 - April 2022
    Responsible for completing reports by recording information, observations, occurrences,
    and surveillance activities, including interviewing of witnesses and acquiring signatures.
    Maintaining environments by monitoring the grounds and equipment controls.
    Logging into security headquarters on the hour during the day and every 2 hours
    with the night shift, notifying control of all in order statuses.
    Utilizing armed force when necessary, to protect company belongings, visitors,
    employees, and clients when needed.
    Apprehending suspects in the event of security breaches and detaining them until
    the police arrive on the scene.
    Resume Templates
    Build this template
    """

    entries = split_experience_entries(block)

    assert len(entries) == 1
    assert entries[0][0] == "Security Guard at ADT Security, Port Washington"
    assert "January 2021 - April 2022" in entries[0]
    assert any("occurrences" in line for line in entries[0])
    assert any("including interviewing" in line for line in entries[0])
    assert any("control of all in order statuses" in line for line in entries[0])


def test_split_experience_entries_drops_divyank_header_residue_before_real_entry() -> None:
    block = """
    CURRICULUM VITAE DIVYANK SINGH
    Security Guard at Example Corp, Jaipur
    January 2021 - April 2022
    Handled patrol duties.
    """

    entries = split_experience_entries(block)

    assert entries == [[
        "Security Guard at Example Corp, Jaipur",
        "January 2021 - April 2022",
        "Handled patrol duties.",
    ]]


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


def test_parse_experience_block_parses_markdown_experience_table_rows() -> None:
    block = """
| Name Of Organization | City, Country. | Designation | From | To | Duration | Reason For Leaving |
| --- | --- | --- | --- | --- | --- | --- |
| Applied Automation Systems | Coimbatore, India. | Plant Maintenance technician. | 02/05/2010 | 05/11/2010 | 6 Months | Layoff due to power cut. |
| LMW (Unit - I) | Coimbatore, India. | Maintenance work quality Inspector | 24/12/2010 | 24/12/2011 | 1 Year | Apprentice Period Over. |
"""

    entries = parse_experience_block(block)

    assert len(entries) == 2
    assert entries[0]["company"] == "Applied Automation Systems"
    assert entries[0]["position"] == "Plant Maintenance technician"
    assert entries[0]["location"] == "Coimbatore, India."
    assert entries[0]["startDate"] is not None
    assert entries[0]["responsibilityBullets"] == ["Reason for leaving: Layoff due to power cut."]
    assert entries[1]["company"] == "LMW (Unit - I)"
    assert entries[1]["position"] == "Maintenance work quality Inspector"


def test_parse_experience_block_keeps_table_as_text_when_headers_are_not_clear_experience_schema() -> None:
    block = """
| Skill | Level |
| --- | --- |
| Investigation | Advanced |
| Surveillance | Intermediate |
"""

    entries = parse_experience_block(block)

    assert len(entries) == 1
    assert entries[0]["company"] == "Experience"
    assert "| Skill | Level |" in str(entries[0]["responsibilities"])


def test_parse_experience_block_prefers_experience_shaped_table_over_label_value_table() -> None:
    block = """
| Name | : | PRASANNA VENGATESH.S |
| --- | --- | --- |
| Father's name | : | SOUNDARARAJAN.M.S |
| Mother's name | : | RAJALAKSHMI.S |

| Name Of Organization | City, Country. | Designation | From | To | Duration | Reason For Leaving |
| --- | --- | --- | --- | --- | --- | --- |
| Applied Automation Systems | Coimbatore, India. | Plant Maintenance technician. | 02/05/2010 | 05/11/2010 | 6 Months | Layoff due to power cut. |
| LMW (Unit - I) | Coimbatore, India. | Maintenance work quality Inspector | 24/12/2010 | 24/12/2011 | 1 Year | Apprentice Period Over. |
"""

    entries = parse_experience_block(block)

    assert len(entries) == 2
    assert entries[0]["company"] == "Applied Automation Systems"
    assert entries[1]["company"] == "LMW (Unit - I)"
    assert all("Father's name" not in str(entry["responsibilities"]) for entry in entries)


def test_parse_experience_block_parses_realistic_matrix_after_heading_row_is_consumed() -> None:
    block = """
| --- | --- | --- | --- | --- | --- | --- |
| Name Of Organization | City, Country. | Designation | From | To | Duration | Reason For Leaving |
| Applied Automation Systems | Coimbatore, India. | Plant Maintenance technician. | 02/05/2010 | 05/11/2010 | 6 Months | Layoff due to power cut. |
| LMW (Unit - I) | Coimbatore, India. | Maintenance work quality Inspector | 24/12/2010 | 24/12/2011 | 1 Year | Apprentice Period Over. |
| Sun Business Solutions | Trichy, India. | AMC Maintenance technician. | 05/02/2012 | 12/08/2012 | 6 Months | Salary Problem. |
"""

    entries = parse_experience_block(block)

    assert len(entries) == 3
    assert entries[2]["company"] == "Sun Business Solutions"
    assert entries[2]["position"] == "AMC Maintenance technician"


def test_parse_experience_block_reconstructs_coarse_ocr_matrix_rows_around_date_anchors() -> None:
    block = """
    Name Of
    City 9
    Designation
    From
    To
    Duration Reason For
    Organization
    Country.
    Leaving
    Applied
    Plant
    Coimbatore,
    due to
    Automation
    Maintenance
    02/05/2010 05/11/2010 6 Months Layoff
    Systems
    India.
    technician.
    power cut.
    Maintenance
    Coimbatore,
    Apprentice
    LMW (Unit - I)
    India.
    work quality
    24/12/2010 24/12/2011 1 Year
    Period Over.
    Inspector
    AMC
    Sun Business
    Trichy,
    Salary
    Solutions
    India.
    Maintenance
    05/02/2012 12/08/2012 6 Months
    Problem.
    technician.
    """

    entries = parse_experience_block(block)

    assert 3 <= len(entries) <= 5
    assert entries[0]["company"] == "Applied Automation Systems"
    assert entries[0]["position"] == "Plant Maintenance technician."
    assert entries[0]["location"] == "Coimbatore, India."
    assert entries[0]["responsibilityBullets"] == ["Reason for leaving: Layoff due to power cut."]
    assert entries[1]["company"] == "LMW (Unit - I)"
    assert entries[1]["position"] == "Maintenance work quality Inspector AMC"
    assert entries[1]["location"] == "Coimbatore, India."
    assert entries[2]["company"] == "Sun Business Solutions"
    assert entries[2]["location"] == "Trichy, India."


def test_build_education_entries_parses_markdown_education_table_rows() -> None:
    sections = {
        "EDUCATION": [
            """
| Qualification | Institution | Percentage of marks | Year of passing |
| --- | --- | --- | --- |
| Diploma in Instrumentation & Control Engineering | Seshasayee Institute of Technology, Trichy. | 78% | 2010 |
| S.S.L.C | St.Joseph's hr secondary school, Trichy. | 88% | 2007 |
"""
        ]
    }

    entries = build_education_entries(sections, "")

    assert len(entries) == 2
    assert entries[0]["degree"] == "Diploma in Instrumentation & Control Engineering"
    assert entries[0]["institution"] == "Seshasayee Institute of Technology, Trichy."
    assert entries[0]["summary"] == "78%"
    assert entries[1]["degree"] == "S.S.L.C"
    assert entries[1]["institution"] == "St.Joseph's hr secondary school, Trichy."


def test_build_education_entries_prefers_education_table_over_label_value_table() -> None:
    sections = {
        "EDUCATION": [
            """
| Name | : | PRASANNA VENGATESH.S |
| --- | --- | --- |
| Father's name | : | SOUNDARARAJAN.M.S |

| Qualification | Institution | Percentage of marks | Year of passing |
| --- | --- | --- | --- |
| Diploma in Instrumentation & Control Engineering | Seshasayee Institute of Technology, Trichy. | 78% | 2010 |
| S.S.L.C | St.Joseph's hr secondary school, Trichy. | 88% | 2007 |
"""
        ]
    }

    entries = build_education_entries(sections, "")

    assert len(entries) == 2
    assert entries[0]["degree"] == "Diploma in Instrumentation & Control Engineering"
    assert all("Father's name" not in str(entry["summary"]) for entry in entries)


def test_build_education_entries_keeps_non_education_table_fallback_behavior() -> None:
    sections = {
        "EDUCATION": [
            """
| Skill | Level |
| --- | --- |
| Investigation | Advanced |
| Surveillance | Intermediate |
"""
        ]
    }

    entries = build_education_entries(sections, "")

    assert entries == []


def test_extract_sections_recognizes_existing_education_heading_variants() -> None:
    raw_text = """
ACADEMIC CREDENTIALS:
Qualification details

EDUCATION BACKGROUND:
More qualification details
"""

    sections = extract_sections(raw_text)

    assert "EDUCATION" in sections
    combined = "\n".join(sections["EDUCATION"])
    assert "Qualification details" in combined
    assert "More qualification details" in combined


def test_extract_education_markdown_table_region_trims_trailing_non_education_content() -> None:
    block = """
| Qualification | Institution | Percentage of marks | Year of passing |
| --- | --- | --- | --- |
| Diploma in Instrumentation & Control Engineering | Seshasayee Institute of Technology, Trichy. | 78% | 2010 |
| S.S.L.C | St.Joseph's hr secondary school, Trichy. | 88% | 2007 |

SKILLS:
* Microsoft office

ACHIEVEMENTS:
* Played one time National in Handball.

| LANGUAGE KNOWN | Read | Write | Speak |
| --- | --- | --- | --- |
| Hindi | ☑ | ☑ | ☑ |
"""

    region = extract_education_markdown_table_region(block)

    assert region is not None
    assert "Qualification | Institution | Percentage of marks | Year of passing" in region
    assert "SKILLS:" not in region
    assert "ACHIEVEMENTS:" not in region
    assert "LANGUAGE KNOWN" not in region


def test_extract_language_markdown_table_region_trims_non_language_content() -> None:
    block = """
| LANGUAGE KNOWN | Read | Write | Speak |
| --- | --- | --- | --- |
| Hindi | ☑ | ☑ | ☑ |
| English | ☑ | ☑ | ☑ |

ACHIEVEMENTS:
* Played one time National in Handball.
"""

    region = extract_language_markdown_table_region(block)

    assert region is not None
    assert "LANGUAGE KNOWN" in region
    assert "ACHIEVEMENTS:" not in region


def test_extract_sections_preserves_multiline_for_carried_language_table_raw_sections() -> None:
    raw_text = "Name: Test User"
    raw_sections = [
        {
            "label": "LANGUAGES",
            "content": """
| LANGUAGE KNOWN | Read | Write | Speak |
| --- | --- | --- | --- |
| Hindi | ☑ | ☑ | ☑ |
| English | ☑ | ☑ | ☑ |
| German | ☑ | ☐ | ☐ |
""",
        }
    ]

    sections = extract_sections(raw_text, raw_sections=raw_sections)

    assert sections["LANGUAGES"] == [
        "| LANGUAGE KNOWN | Read | Write | Speak |\n| --- | --- | --- | --- |\n| Hindi | ☑ | ☑ | ☑ |\n| English | ☑ | ☑ | ☑ |\n| German | ☑ | ☐ | ☐ |"
    ]

    entries = build_language_entries(sections)

    assert [entry["name"] for entry in entries] == ["Hindi", "English", "German"]


def test_build_language_entries_parses_language_table_names_only() -> None:
    sections = {
        "LANGUAGES": [
            """
| LANGUAGE KNOWN | Read | Write | Speak |
| --- | --- | --- | --- |
| Hindi | ☑ | ☑ | ☑ |
| English | ☑ | ☑ | ☑ |
| German | ☑ | ☐ | ☐ |
"""
        ]
    }

    entries = build_language_entries(sections)

    assert [entry["name"] for entry in entries] == ["Hindi", "English", "German"]


def test_trim_skills_block_stops_at_clear_non_skill_subsection_headings() -> None:
    block = """
* Microsoft office
* C language
FINAL YEAR PROJECT:
* Ornithopter: It is a flying object.
ACHIEVEMENTS:
* Played one time National in Handball.
"""

    trimmed = trim_skills_block(block)

    assert "Microsoft office" in trimmed
    assert "C language" in trimmed
    assert "FINAL YEAR PROJECT" not in trimmed
    assert "Ornithopter" not in trimmed
    assert "ACHIEVEMENTS" not in trimmed


def test_trim_skills_block_preserves_skill_lines_with_project_word() -> None:
    block = """
* Project management
* Vendor coordination
"""

    trimmed = trim_skills_block(block)

    assert "Project management" in trimmed
    assert "Vendor coordination" in trimmed


def test_canonicalize_cv_trims_skills_block_before_skill_tokenization() -> None:
    raw_text = """
SKILLS:
* Microsoft office
* C language
FINAL YEAR PROJECT:
* Ornithopter: It is a flying object.
| LANGUAGE KNOWN | Read | Write | Speak |
| --- | --- | --- | --- |
| Hindi | ☑ | ☑ | ☑ |
"""

    payload = canonicalize_cv(raw_text, mode="text", diagnostics={"route": "external_ocr"})

    skill_section = next(section for section in payload["rawSections"] if section["label"] == "SKILLS")
    assert "FINAL YEAR PROJECT" not in skill_section["content"]
    assert "LANGUAGE KNOWN" not in skill_section["content"]
    assert [entry["name"] for entry in payload["normalized"]["skills"]] == [
        "* Microsoft office",
        "* C language",
    ]


def test_trim_family_local_contamination_stops_achievements_before_language_table() -> None:
    sections = {
        "ACHIEVEMENTS": [
            """
* Played one time National in Handball.
| LANGUAGE KNOWN | Read | Write | Speak |
| --- | --- | --- | --- |
| Hindi | ☑ | ☑ | ☑ |
"""
        ],
        "LANGUAGES": [
            """
| LANGUAGE KNOWN | Read | Write | Speak |
| --- | --- | --- | --- |
| Hindi | ☑ | ☑ | ☑ |
"""
        ],
    }

    trimmed = _trim_family_local_contamination(sections)

    assert "LANGUAGE KNOWN" not in trimmed["ACHIEVEMENTS"][0]
    assert "Played one time National" in trimmed["ACHIEVEMENTS"][0]


def test_canonicalize_cv_trims_body_and_achievements_cross_family_spillover() -> None:
    raw_text = """
CURRICULUM VITAE
DIVYANK SINGH
CAREER OBJECTIVE:
* Seeking entry level assignments.
EDUCATION BACKGROUND:
| EXAM/DEGREE | YEAR | NAME OF INSTITUTION | UNIVERSITY/BOARD | PERCENTAGE % |
| --- | --- | --- | --- | --- |
| B.TECH | 2014 | Engineering and Technology | Jaipur National University | 67.4 |
SKILLS:
* Microsoft office
* C language
FINAL YEAR PROJECT:
* Ornithopter: It is a flying object.
ACHIEVEMENTS:
* Played one time National in Handball.
LANGUAGE KNOWN:
| LANGUAGE KNOWN | Read | Write | Speak |
| --- | --- | --- | --- |
| Hindi | ☑ | ☑ | ☑ |
| English | ☑ | ☑ | ☑ |
"""

    payload = canonicalize_cv(raw_text, mode="text", diagnostics={"route": "external_ocr"})
    labels = [section["label"] for section in payload["rawSections"]]
    body = next(section["content"] for section in payload["rawSections"] if section["label"] == "BODY")
    achievements = next(section["content"] for section in payload["rawSections"] if section["label"] == "ACHIEVEMENTS")

    assert labels == ["BODY", "EDUCATION", "SKILLS", "ACHIEVEMENTS", "LANGUAGES"]
    assert "EDUCATION BACKGROUND" not in body
    assert "LANGUAGE KNOWN" not in achievements
    assert "final year project" not in payload["normalized"]["summary"]["text"].lower()


def test_canonicalize_cv_rejects_reason_for_leaving_as_summary_candidate() -> None:
    raw_text = """
PROFESSIONAL EXPERIENCE
| Name Of Organization | City, Country. | Designation | From | To | Duration | Reason For Leaving |
| --- | --- | --- | --- | --- | --- | --- |
| Applied Automation Systems | Coimbatore, India. | Plant Maintenance technician. | 02/05/2010 | 05/11/2010 | 6 Months | Layoff due to power cut. |
| LMW (Unit - I) | Coimbatore, India. | Maintenance work quality Inspector | 24/12/2010 | 24/12/2011 | 1 Year | Apprentice Period Over. |
"""

    payload = canonicalize_cv(raw_text, mode="text", diagnostics={"route": "external_ocr"})

    summary = payload["normalized"].get("summary")
    assert not summary or not summary.get("text")


def test_canonicalize_cv_rejects_page_marker_and_header_residue_as_summary() -> None:
    raw_text = """
Page 1 of 2
CURRICULUM VITAE
DIVYANK SINGH
Email: divyank_singh@outlook.com
LANGUAGES
English
"""

    payload = canonicalize_cv(raw_text, mode="text", diagnostics={"route": "external_ocr"})

    summary = payload["normalized"].get("summary")
    assert not summary or not summary.get("text")


def test_canonicalize_cv_rejects_month_present_metadata_as_summary() -> None:
    raw_text = """
Page 1 of 2
avril - Present (2 ans 5 mois).
NEOMA Business School
"""

    payload = canonicalize_cv(raw_text, mode="text", diagnostics={"route": "external_ocr"})

    summary = payload["normalized"].get("summary")
    assert not summary or not summary.get("text")

    french_range_payload = canonicalize_cv(
        "septembre - mars (1 an 7 mois).\nNEOMA Business School",
        mode="text",
        diagnostics={"route": "external_ocr"},
    )
    french_summary = french_range_payload["normalized"].get("summary")
    assert not french_summary or not french_summary.get("text")


def test_canonicalize_cv_rejects_bilingual_title_line_as_summary() -> None:
    raw_text = """
Océan Atlantique & Mer Méditerranée // Atlantic Ocean & Mediterranean Sea.
NEOMA Business School
"""

    payload = canonicalize_cv(raw_text, mode="text", diagnostics={"route": "external_ocr"})

    summary = payload["normalized"].get("summary")
    assert not summary or not summary.get("text")


def test_extract_name_and_role_skips_skill_preamble_and_finds_actual_name() -> None:
    raw_text = """
www.linkedin.com/in/marion-bonnet-b867b2189 (LinkedIn)
Principales compétences
Gestion de projet
Recrutement international
Sourcing
Certifications
Excel with LinkedIn Recruiter
Assessment
The Predictive Index
Marion BONNET
Responsable Recrutement & Relations Ecoles / Talent Acquisition Lead
Paris, Île-de-France, France
Expérience
"""

    sections = extract_sections(raw_text)
    name, role = extract_name_and_role(raw_text, sections)

    assert name == "Marion Bonnet"
    assert role is None


def test_extract_name_and_role_skips_page_marker_and_contact_preamble_before_name() -> None:
    raw_text = """
Page 1 of 2
Coordonnées
www.linkedin.com/in/marion-bonnet-b867b2189 (LinkedIn)
Principales compétences
Gestion de projet
Recrutement international
Sourcing
Certifications
Excel with LinkedIn Recruiter
Assessment
The Predictive Index
Marion BONNET
Responsable Recrutement & Relations Ecoles / Talent Acquisition Lead
Paris, Île-de-France, France
Expérience
"""

    sections = extract_sections(raw_text)
    name, role = extract_name_and_role(raw_text, sections)

    assert name == "Marion Bonnet"
    assert role is None


def test_extract_name_and_role_keeps_robert_name_detection_stable() -> None:
    raw_text = """
ROBERT COOPER
SECURITY GUARD
email@email.com
3868683442
LOS ANGELES, CA 90291, UNITED STATES
PROFILE
Safety conscious, attentive Security Guard with eight years experience.
"""

    sections = extract_sections(raw_text)
    name, role = extract_name_and_role(raw_text, sections)

    assert name == "Robert Cooper"
    assert role == "Security Guard"
