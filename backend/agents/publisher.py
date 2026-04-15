from crewai import Agent
from crewai.tools import tool
from tools.publish_tool import post_to_guava_api
from core.config import Config
import json


@tool("post_to_guava_api")
def post_to_guava_api_tool(json_string: str):
    """将新闻数据发布到数据库。"""
    try:
        data = json.loads(json_string) if isinstance(json_string, str) else json_string
        if isinstance(data, dict):
            data = [data]
        return post_to_guava_api(data)
    except Exception as e:
        return f"Error parsing JSON: {str(e)}"


publisher_agent = Agent(
    role="新闻发布主管",
    goal="必须执行 post_to_guava_api_tool 工具，将稿件存入数据库。",
    backstory=(
        "你是一名严谨的发布员。"
        "你的流程是：接收稿件 -> 转换为 JSON -> 调用 post_to_guava_api_tool。"
        "你必须看到工具返回成功状态。"
    ),
    tools=[post_to_guava_api_tool],
    verbose=True,
    allow_delegation=False,
    llm=Config.llm,
    max_iter=3,
    memory=False,
)
