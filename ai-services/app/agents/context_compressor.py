from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from typing import Any

MAX_COMPRESSED_CHARS = 2000


def _extract_text(content: Any) -> str:
    """
    Safely extract text from LangChain AIMessage content.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        # Handle tool / structured message formats
        return " ".join(
            str(item.get("text", ""))
            for item in content
            if isinstance(item, dict)
        )
    return str(content)


def compress_context(raw_context: str) -> str:
    if len(raw_context) <= MAX_COMPRESSED_CHARS:
        return raw_context

    llm = ChatOllama(
        model="mistral",
        temperature=0.1,
        num_ctx=4096
    )

    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            "Summarize the following context for an AI tutor. "
            "Preserve mistakes, patterns, and constraints. "
            "Do not add new information."
        ),
        ("human", "{context}")
    ])

    message = (prompt | llm).invoke({
        "context": raw_context[:5000]
    })

    text = _extract_text(message.content)

    return text[:MAX_COMPRESSED_CHARS]
