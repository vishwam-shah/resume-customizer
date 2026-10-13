"""Generate the fictional sample resume used by the UI's "Try an example".

uv run python scripts/make_sample_resume.py
"""

import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))

from app.features.export.pdf import html_to_pdf, resume_html  # noqa: E402
from app.features.resume.models import ResumeDoc  # noqa: E402

sample = ResumeDoc.model_validate(
    {
        "contact": {
            "name": "Priya Raman",
            "headline": "Software Engineer",
            "email": "priya.raman@example.com",
            "phone": "+91 98765 01234",
            "location": "Pune, India",
            "links": [
                {"label": "LinkedIn", "url": "https://linkedin.com/in/priya-raman-example"},
                {"label": "GitHub", "url": "https://github.com/priya-raman-example"},
            ],
        },
        "summary": "Software engineer with three years of experience building web applications "
        "and internal tools. Comfortable across the stack, from React interfaces to Python "
        "services and SQL databases. Enjoys turning manual processes into reliable software.",
        "skills": [
            {"name": "Languages", "items": ["Python", "JavaScript", "TypeScript", "SQL"]},
            {"name": "Frameworks", "items": ["React", "Django", "Flask", "Express"]},
            {
                "name": "Data & Cloud",
                "items": ["PostgreSQL", "Redis", "AWS (EC2, S3, Lambda)", "Docker"],
            },
            {"name": "AI", "items": ["OpenAI API", "Hugging Face", "pandas", "scikit-learn"]},
            {"name": "Practices", "items": ["Git", "pytest", "Jest", "Scrum", "Code review"]},
        ],
        "experience": [
            {
                "id": "exp-1",
                "role": "Software Engineer",
                "company": "Ledgerline Fintech",
                "location": "Pune, India",
                "start": "Jun 2023",
                "end": "Present",
                "bullets": [
                    "Worked on the customer support dashboard used by 40 support agents, built "
                    "with React and a Flask REST API.",
                    "Added a ticket summarization feature using the OpenAI API that cut average "
                    "handling time by 18%.",
                    "Moved nightly reconciliation jobs from cron scripts to AWS Lambda, reducing "
                    "failed runs from 12 to 1 per month.",
                    "Wrote pytest suites for the payments service, raising coverage from 41% to "
                    "78%.",
                    "Helped onboard two new engineers and reviewed pull requests for the team.",
                ],
            },
            {
                "id": "exp-2",
                "role": "Associate Developer",
                "company": "Brightpath Learning",
                "location": "Bengaluru, India",
                "start": "Jul 2021",
                "end": "May 2023",
                "bullets": [
                    "Built course management pages in Django and PostgreSQL for 25,000 monthly "
                    "learners.",
                    "Created a Redis cache for the course catalog, cutting page load time from "
                    "2.1s to 0.6s.",
                    "Fixed accessibility issues found in an audit, including keyboard navigation "
                    "and form labels.",
                    "Took part in daily Scrum stand-ups and sprint planning.",
                ],
            },
        ],
        "projects": [
            {
                "id": "proj-1",
                "name": "DocSearch",
                "link": "https://github.com/priya-raman-example/docsearch",
                "bullets": [
                    "Built a semantic search tool over 3,000 internal PDFs using Hugging Face "
                    "sentence embeddings and a FAISS index.",
                    "Wrapped it in a small FastAPI service with a React front end.",
                ],
            }
        ],
        "education": [
            {
                "id": "edu-1",
                "degree": "B.Tech, Computer Engineering",
                "school": "College of Engineering Pune",
                "location": "Pune, India",
                "start": "2017",
                "end": "2021",
                "details": ["CGPA 8.4/10"],
            },
        ],
        "extras": [
            {"title": "Certifications", "items": ["AWS Certified Cloud Practitioner (2022)"]},
        ],
    }
)

out = root.parent / "frontend" / "public" / "samples" / "sample-resume.pdf"
out.write_bytes(html_to_pdf(resume_html(sample), title="Priya Raman resume", author="Priya Raman"))
print(f"wrote {out} ({out.stat().st_size} bytes)")
