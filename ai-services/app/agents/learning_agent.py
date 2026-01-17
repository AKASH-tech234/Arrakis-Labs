from langchain_core.output_parsers import PydanticOutputParser

from app.prompts.learning import LEARNING_PROMPT
from app.schemas.learning import LearningRecommendation
from app.services.llm import get_llm


def learning_agent(context: str) -> LearningRecommendation:
    llm = get_llm()

    parser = PydanticOutputParser(
        pydantic_object=LearningRecommendation
    )

    chain = LEARNING_PROMPT | llm | parser

    result = chain.invoke({
        "context": context
    })

    return result


