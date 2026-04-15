import os
from crewai import Agent
from core.config import Config
from crewai_tools import GithubSearchTool, ScrapeWebsiteTool, WebsiteSearchTool

os.environ["OPENAI_API_KEY"] = "sk-dummy-for-tools"
if "OPENAI_API_BASE" in os.environ:
    del os.environ["OPENAI_API_BASE"]
os.environ["OLLAMA_API_KEY"] = os.getenv("OLLAMA_API_KEY", "")

try:
    from composio_crewai import ComposioToolSet, App

    toolset = ComposioToolSet(api_key=Config.COMPOSIO_API_KEY)
    try:
        professional_apps = toolset.get_tools(apps=[App.YAHOO_FINANCE, App.PUBMED, App.TAVILY_SEARCH])
    except Exception:
        if hasattr(toolset, "get_crewai_tools"):
            professional_apps = toolset.get_crewai_tools(apps=[App.YAHOO_FINANCE, App.PUBMED, App.TAVILY_SEARCH])
        else:
            professional_apps = []
except Exception as e:
    print(f"⚠️ Composio 环境异常: {e}")
    professional_apps = []


local_embedder = {
    "provider": "ollama",
    "config": {"model": "nomic-embed-text", "base_url": "http://localhost:11434"},
}


github_skill = GithubSearchTool(gh_token=Config.GITHUB_TOKEN)
web_search_tool = WebsiteSearchTool(embedder=local_embedder)


scout_agent = Agent(
    role="全能领域情报指挥官",
    goal="指挥 6 套专业 Skill 工具集，按定义格式产出原始结构化事实。",
    backstory=(
        "你是一名顶级情报官。"
        "严禁编造 URL，必须先搜索真实来源，再抓取数据。"
        "你只返回硬核事实，避免主观废话。"
    ),
    tools=[github_skill, *professional_apps, ScrapeWebsiteTool(), web_search_tool],
    llm=Config.llm,
    verbose=True,
    allow_delegation=False,
    memory=False,
)
