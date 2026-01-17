from langchain_core.output_parsers import PydanticOutputParser

from app.prompts.report import REPORT_PROMPT
from app.schemas.report import WeeklyProgressReport
from app.services.llm import get_llm


def report_agent(context: str) -> WeeklyProgressReport:
    llm = get_llm()

    parser = PydanticOutputParser(
        pydantic_object=WeeklyProgressReport
    )

    chain = REPORT_PROMPT | llm | parser

    result = chain.invoke({
        "context": context
    })

    return result
