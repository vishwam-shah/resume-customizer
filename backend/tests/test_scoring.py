from app.features.resume.render_text import resume_to_text
from app.features.scoring.ats import ats_score
from app.features.scoring.keywords import contains_term
from app.features.scoring.match import match_score
from tests.factories import make_job, make_resume


def test_contains_term_respects_boundaries():
    assert contains_term("we use java and go", "java")
    assert not contains_term("we use javascript", "java")
    assert contains_term("built rest apis", "rest api")
    assert contains_term("deployed on k8s", "kubernetes")
    assert contains_term("c++ and c#", "c++")


def test_match_score_weights_must_haves():
    score = match_score(resume_to_text(make_resume()), make_job())
    assert "Kubernetes" in score.missing_must_have
    assert "Python" in score.matched_must_have
    assert 0 < score.score < 100


def test_ats_score_is_bounded_and_explained():
    result = ats_score(make_resume(), make_job())
    assert 0 <= result.score <= 100
    assert {c.key for c in result.components} >= {"keywords", "sections", "contact", "impact"}
    assert sum(c.max_points for c in result.components) == 100


def test_ats_flags_missing_contact():
    resume = make_resume()
    resume.contact.email = None
    assert any("email" in issue for issue in ats_score(resume, make_job()).issues)


def test_spelling_variants_match_but_meaning_stays_strict():
    assert contains_term("full-stack developer", "Full Stack")
    assert contains_term("a fullstack developer", "full stack")
    assert contains_term("full stack developer", "full-stack")
    assert contains_term("built rag pipelines", "retrieval augmented generation")
    assert contains_term("integrated llms", "LLM")
    assert not contains_term("javascript", "java")
    assert not contains_term("reaction time", "react")
