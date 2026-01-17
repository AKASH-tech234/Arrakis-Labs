from langchain_core.output_parsers import PydanticOutputParser

from app.prompts.difficulty import DIFFICULTY_PROMPT
from app.schemas.difficulty import DifficultyAdjustment
from app.services.llm import get_llm


def difficulty_agent(context: str) -> DifficultyAdjustment:
    llm = get_llm()

    parser = PydanticOutputParser(
        pydantic_object=DifficultyAdjustment
    )

    chain = DIFFICULTY_PROMPT | llm | parser

    result = chain.invoke({
        "context": context
    })

    return result
