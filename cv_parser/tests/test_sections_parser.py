from cv_parser.extract.sections import parse_sections, split_tokens


def test_parse_sections_identifies_headings():
    text = """
    SUMMARY
    Product-focused engineer.

    EXPERIENCE
    Company A - Built things
    Company B - Improved processes

    EDUCATION
    BSc Computer Science, University

    SKILLS
    Python, Go, SQL

    LANGUAGES
    English, French
    """
    sections = parse_sections(text)
    assert sections["experience"]
    assert sections["education"]
    assert sections["skills"]
    assert sections["languages"]
    tokens = split_tokens(sections["skills"])
    assert "Python" in tokens


def test_parse_sections_handles_multilingual_headings():
    text = """
    PROFIL
    Ingénieur produit.

    EXPÉRIENCE
    Société A - Chef de projet

    FORMATION
    Grande École d'Ingénieurs

    COMPÉTENCES
    Gestion, Analyse

    LANGUES
    Français; Anglais
    """

    sections = parse_sections(text)
    assert sections["experience"]
    assert sections["education"]
    assert sections["skills"]
    assert sections["languages"]


def test_parse_sections_splits_experience_entries():
    text = """
    EXPERIENCE
    Engineer Jan 2020 – Apr 2021
    ACME Corp, Seattle, WA
    - Built automation scripts
    - Led deployments

    Analyst May 2021 – Present
    Example Inc, New York, NY
    Managed reporting across business units
    """

    sections = parse_sections(text)
    assert len(sections["experience"]) == 2
    assert "Built automation scripts" in sections["experience"][0]
    assert "Example Inc" in sections["experience"][1]


def test_parse_sections_preserves_achievement_sentences():
    text = """
    ACHIEVEMENTS
    - Increased retention by 28%
    Reduced onboarding time by 35%
    - Improved satisfaction scores to 4.8/5
    """

    sections = parse_sections(text)
    achievements = sections["achievements"]
    assert len(achievements) == 2
    assert "retention" in achievements[0]
    assert "satisfaction" in achievements[1]
