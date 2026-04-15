import os
from dotenv import load_dotenv
from crewai import LLM

load_dotenv(override=True)


class Config:
    TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    COMPOSIO_API_KEY = os.getenv("COMPOSIO_API_KEY")
    GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

    llm = LLM(
        model="ollama/qwen2.5:7b",
        api_key=os.getenv("OLLAMA_API_KEY"),
        temperature=0.7,
        verbose=True,
    )

print("✅ 系统配置已加载。后端: Ollama Online API")
