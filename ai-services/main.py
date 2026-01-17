from fastapi import FastAPI
from streamlit import feedback
from app.schemas.submission import SubmissionContext
from app.rag.context_builder import build_context
from app.agents.feedback_agent import feedback_agent
from app.api.routes import router

app = FastAPI(title="Mentat Trials AI Service")

app.include_router(router)
@app.post("/feedback")
def get_feedback(submission: SubmissionContext):
    context = build_context(submission, [])
    feedback = feedback_agent(context)
    return { "feedback": feedback }

