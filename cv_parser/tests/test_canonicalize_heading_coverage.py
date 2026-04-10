import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "canonicalize.py"
SPEC = importlib.util.spec_from_file_location("cv_parser_canonicalize_under_test", MODULE_PATH)
assert SPEC is not None
assert SPEC.loader is not None
CANONICALIZE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CANONICALIZE)

_trim_family_local_contamination = CANONICALIZE._trim_family_local_contamination
build_education_entries = CANONICALIZE.build_education_entries
build_experience_entries = CANONICALIZE.build_experience_entries
build_language_entries = CANONICALIZE.build_language_entries
build_skill_entries = CANONICALIZE.build_skill_entries
canonicalize_cv = CANONICALIZE.canonicalize_cv
extract_name_and_role = CANONICALIZE.extract_name_and_role
extract_education_markdown_table_region = CANONICALIZE.extract_education_markdown_table_region
extract_language_markdown_table_region = CANONICALIZE.extract_language_markdown_table_region
extract_sections = CANONICALIZE.extract_sections
trim_skills_block = CANONICALIZE.trim_skills_block
parse_experience_block = CANONICALIZE.parse_experience_block
parse_education_block = CANONICALIZE.parse_education_block
split_experience_entries = CANONICALIZE.split_experience_entries
strip_leading_markdown_heading = CANONICALIZE.strip_leading_markdown_heading


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


def test_build_experience_entries_infers_text_pdf_experience_block_for_robert_layout() -> None:
    raw_text = """
    ROBERT COOPER
    SECURITY GUARD LOS ANGELES, CA 90291, UNITED STATES 3868683442
    DETAILS PROFILE
    1515 Pacific Ave Safety conscious, attentive Security Guard.
    San Antonio EMPLOYMENT HISTORY
    Security Guard at ADT Security, Port Washington
    January 2021 - April 2022
    Responsible for completing reports by recording information, observations, occurrences,
    and surveillance activities, including interviewing of witnesses and acquiring signatures.
    LINKS
    LinkedIn
    Pinterest
    Resume Templates
    Build this template
    Maintaining environments by monitoring the grounds and equipment controls.
    SKILLS
    Investigation skills
    Security Guard at Copwatch, Jogbani
    January 2020 - April 2022
    Inspecting restrooms after closing time for vagrants/ unauthorized personnel.
    EDUCATION
    Certified Protection Guard Program (CPOP)
    """

    entries = build_experience_entries({}, raw_text)

    assert len(entries) == 2
    assert entries[0]["company"] == "ADT Security"
    assert entries[0]["position"] == "Security Guard"
    assert entries[1]["company"] == "Copwatch"
    assert entries[1]["position"] == "Security Guard"


def test_build_experience_entries_fails_closed_for_text_pdf_without_experience_heading() -> None:
    raw_text = """
    CURRICULUM VITAE
    DIVYANK SINGH
    Email: divyank_singh@outlook.com
    CAREER OBJECTIVE:
    Seeking entry level assignments in production and maintenance.
    ACADEMIC QUALIFICATION:
    B.TECH 2014 Engineering and Technology Jaipur National University 67.4
    SKILLS:
    Microsoft office
    ACHIEVEMENTS:
    Participated in paper presentation in Jaipur National University 2013.
    """

    entries = build_experience_entries({}, raw_text)

    assert entries == []


def test_build_experience_entries_does_not_emit_name_blob_for_unusable_working_experience_heading() -> None:
    raw_text = """
    Curriculum vitae
    Farman Ali
    Electrical Engineer
    WORKING EXPERINCE:
    One year worked in ST Microelectronic Greater Noida Honeywell third party roll as a BMS operator.
    Presently working in CBRE through Strabag as a BMS Operator and posted at a site MetLife global operation support Sec. 135 Noida. From 01stjanuary 2016 to till date.
    ACADEMIC QUALIFICATION :
    Diploma in Computer certificate application.
    """

    entries = build_experience_entries({}, raw_text)

    assert entries == []


def test_parse_experience_block_strips_header_date_and_education_echo_from_university_employer_entry() -> None:
    block = """
    Undergraduate Research Assistant at Southwestern University, Georgetown, TX
    Sep. 2018 - Present
    Explored data sets and authored lab reports.
    Texas A&M University
    Relevant Coursework: Statistical methods and field sampling.
    """

    entries = parse_experience_block(block)

    assert len(entries) == 1
    assert entries[0]["company"] == "Southwestern University"
    assert entries[0]["position"] == "Undergraduate Research Assistant"
    assert entries[0]["location"] == "Georgetown, TX"
    assert entries[0]["isCurrent"] is True
    bullets = list(entries[0]["responsibilityBullets"])
    assert bullets == ["Explored data sets and authored lab reports"]
    responsibilities = str(entries[0]["responsibilities"])
    assert "Southwestern University" not in responsibilities
    assert "Sep. 2018 - Present" not in responsibilities
    assert "Texas A&M University" not in responsibilities
    assert "Relevant Coursework" not in responsibilities


def test_parse_experience_block_fails_closed_for_institution_only_fragment() -> None:
    block = """
    Texas A&M University
    Relevant Coursework: Statistical methods and field sampling.
    Dean's List and GPA honors.
    """

    entries = parse_experience_block(block)

    assert entries == []


def test_parse_experience_block_splits_embedded_next_job_header_from_robert_narrative() -> None:
    block = """
    Security Guard at ADT Security, Port Washington
    January 2021 - April 2022
    Responsible for completing reports by recording information, observations, occurrences, and surveillance activities, including interviewing of witnesses and acquiring signatures Security Guard at Copwatch, Jogbani Primary purpose is to scan area of grounds for objects/items that seem out of place.
    January 2020 - April 2022
    Inspecting restrooms after closing time for vagrants/ unauthorized personnel.
    """

    entries = parse_experience_block(block)

    assert len(entries) == 2
    assert entries[0]["company"] == "ADT Security"
    assert entries[0]["position"] == "Security Guard"
    assert "Copwatch" not in str(entries[0]["responsibilities"])
    assert entries[1]["company"] == "Copwatch"
    assert entries[1]["position"] == "Security Guard"
    assert any("Inspecting restrooms" in bullet for bullet in entries[1]["responsibilityBullets"])


def test_parse_experience_block_dedupes_repeated_jake_bullets_with_punctuation_variants() -> None:
    block = """
    Information Technology Support Specialist at Southwestern University
    Sep. 2018 - Present
    Communicate with managers to set up campus computers used on campus.
    Communicate with managers to set up campus computers used on campus
    Assess and troubleshoot computer problems brought by students, faculty and staff.
    Assess and troubleshoot computer problems brought by students, faculty and staff
    """

    entries = parse_experience_block(block)

    assert len(entries) == 1
    bullets = list(entries[0]["responsibilityBullets"])
    assert bullets == [
        "Communicate with managers to set up campus computers used on campus",
        "Assess and troubleshoot computer problems brought by students, faculty and staff",
    ]


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
    assert "Applied" in str(entries[0]["company"])
    assert any(token in str(entries[0]["company"]) for token in ["Automation", "Systems"])
    assert any(token in str(entries[0]["position"]) for token in ["Maintenance", "technician"])
    assert "Coimbatore" in str(entries[0]["location"])
    assert "India" in str(entries[0]["location"])
    assert entries[0]["startDate"] is not None
    assert any("Reason for leaving:" in bullet for bullet in entries[0]["responsibilityBullets"])
    assert entries[1]["company"]
    assert entries[1]["startDate"] is not None
    assert any(token in str(entries[1]["position"]) for token in ["Maintenance", "Inspector", "quality"])
    assert entries[2]["company"]
    assert entries[2]["startDate"] is not None
    assert any(token in str(entries[2]["position"]) for token in ["Maintenance", "technician", "Planner", "Supervisor"])


def test_parse_experience_block_rejects_cv308_header_fragments_from_remote_product_path() -> None:
    block = """
    Name Of City , Reason For
    Designation From To Duration
    Organization Country. Leaving
    Applied Plant
    Coimbatore, Layoff due to
    Automation Maintenance 02/05/2010 05/11/2010 6 Months
    India. power cut.
    Systems technician.
    Maintenance
    Coimbatore, Apprentice
    LMW (Unit - I) work quality 24/12/2010 24/12/2011 1 Year
    India. Period Over.
    Inspector
    AMC
    Sun Business Trichy , Salary
    Maintenance 05/02/2012 12/08/2012 6 Months
    Solutions India. Problem.
    technician.
    AMC
    IFB Service T r i c hy,, Got Visa to
    Maintenance 12/12/2012 05/08/2012 8 Months
    ( Q - Electronics) India. UAE.
    Supervisor.
    Dubai , Maintenance 10 Salary
    JAMS 07/08/2013 05/06/2014
    UAE. Planner Months Problem.
    Berkeley Services Maintenance
    (Al-Maktoom Dubai , Planner , 1 year 9 Currently
    26/08/2014 Till Now
    International UAE. KPI Months Working.
    Airport project) Coordinator,
    Nature Of Work :
    In proper inspection and measuring dimensions as per drawing and
    standard sheet.
    """

    entries = parse_experience_block(block)

    assert len(entries) >= 3
    for entry in entries[:3]:
        company = str(entry["company"] or "")
        position = str(entry["position"] or "")
        assert company
        assert "Organization Country" not in company
        assert company != "Systems technician."
        assert entry["startDate"] is not None
        assert any(token in company for token in ["Applied", "LMW", "Sun", "IFB", "JAMS", "Berkeley"]) or any(
            token in position for token in ["Maintenance", "technician", "Planner", "Supervisor", "Inspector"]
        )


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
