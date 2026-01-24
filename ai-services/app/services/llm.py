# # from langchain_openai import ChatOpenAI

# # def get_llm() -> ChatOpenAI:
# #     return ChatOpenAI(
# #         model="gpt-4o-mini",
# #         temperature=0.2
# #     )

# import logging
# from langchain_ollama import ChatOllama

# logger = logging.getLogger("llm_service")

# # Mistral is significantly better at JSON than Llama 2
# MODEL_NAME = "mistral"
# logger.info(f"🤖 LLM Service initialized with model: {MODEL_NAME}")

# def get_llm(temperature: float = 0.2):
#     logger.debug(f"🔧 Creating ChatOllama instance (model={MODEL_NAME}, temp={temperature})")
#     try:
#         llm = ChatOllama(
#             model=MODEL_NAME,
#             temperature=temperature,
#             num_ctx=4096
#         )
#         logger.debug("✅ ChatOllama instance created successfully")
#         return llm
#     except Exception as e:
#         logger.error(f"❌ Failed to create LLM instance: {type(e).__name__}: {e}")
#         raise
    
    
import os
import logging
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger("llm_service")

DEFAULT_MODEL = "gemini-2.5-flash" 

# Load environment variables from .env at startup
load_dotenv()

def get_llm(temperature: float = 0.2):
    """
    Central LLM factory.
    Switched to Gemini.
    """

    api_key = os.getenv("GOOGLE_API_KEY")
    # SECURITY: Never print API keys to logs
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set in .env")

    logger.debug(
        f"Creating Gemini LLM instance "
        f"(model={DEFAULT_MODEL}, temp={temperature})"
    )
    logger.debug(f"Using GOOGLE_API_KEY: {'*' * (len(api_key) - 4) + api_key[-4:]}")

    llm = ChatGoogleGenerativeAI(
        model=DEFAULT_MODEL,
        temperature=temperature,
        google_api_key=api_key,
        convert_system_message_to_human=True,  # IMPORTANT for Gemini
    )

    logger.debug("Gemini LLM instance created")
    return llm
