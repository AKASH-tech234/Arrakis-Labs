from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from app.prompts.feedback import FEEDBACK_PROMPT
from app.services.llm import get_llm
from app.schemas.feedback import FeedbackResponse
from langchain_core.output_parsers import PydanticOutputParser

llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.2
)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a Mentat. Be precise, calm, analytical."),
    ("human", "{context}")
])


def feedback_agent(context: str) -> FeedbackResponse:
    llm = get_llm()

    parser = PydanticOutputParser(
        pydantic_object=FeedbackResponse
    )

    chain = FEEDBACK_PROMPT | llm | parser

    result: FeedbackResponse = chain.invoke({
        "context": context
    })

    return result
