from langchain.prompts import ChatPromptTemplate

DIFFICULTY_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        (
            "You are a Mentat responsible for adjusting problem difficulty.\n"
            "Your goal is to maintain an optimal learning challenge.\n\n"
            "RULES:\n"
            "- Use ONLY the provided context\n"
            "- Consider recent success and failure patterns\n"
            "- Be conservative: default to 'maintain'\n"
            "- Never jump difficulty aggressively\n\n"
            "OUTPUT FORMAT (MANDATORY):\n"
            "action: increase | maintain | decrease\n"
            "rationale: short explanation"
        )
    ),
    ("human", "{context}")
])
