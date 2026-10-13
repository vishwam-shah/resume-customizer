from app.features.job.models import JobAnalysis
from app.features.resume.models import (
    Contact,
    ContactLink,
    EducationItem,
    ExperienceItem,
    ProjectItem,
    ResumeDoc,
    SkillGroup,
)


def make_resume() -> ResumeDoc:
    return ResumeDoc(
        contact=Contact(
            name="Asha Patel",
            headline="Software Engineer",
            email="asha@example.com",
            phone="+91 98765 43210",
            location="Ahmedabad, India",
            links=[ContactLink(label="GitHub", url="https://github.com/asha")],
        ),
        summary="Software engineer who builds web apps.",
        skills=[
            SkillGroup(name="Languages", items=["Python", "TypeScript"]),
            SkillGroup(name="Data", items=["Pinecone", "PostgreSQL"]),
        ],
        experience=[
            ExperienceItem(
                id="exp-1",
                role="Software Engineer",
                company="Acme",
                location=None,
                start="2023",
                end="Present",
                bullets=[
                    "Built a FastAPI service handling 2000 requests per minute",
                    "Added semantic search with Pinecone for 40% faster lookups",
                ],
            )
        ],
        projects=[
            ProjectItem(
                id="proj-1", name="Chat app", link=None, bullets=["Created a React chat app"]
            )
        ],
        education=[
            EducationItem(
                id="edu-1",
                degree="B.E. IT",
                school="GTU",
                location=None,
                start="2019",
                end="2023",
                details=[],
            )
        ],
        extras=[],
    )


def make_job() -> JobAnalysis:
    return JobAnalysis(
        title="Backend Engineer",
        company="Nimbus",
        seniority="mid",
        summary="Builds APIs.",
        must_have_skills=["Python", "FastAPI", "Kubernetes"],
        nice_to_have_skills=["Go"],
        keywords=["vector databases", "PostgreSQL", "REST APIs"],
        responsibilities=["Build APIs"],
    )
