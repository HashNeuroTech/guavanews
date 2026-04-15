import random
from crewai import Task
from datetime import datetime

today = datetime.now().strftime("%Y-%m-%d")
ALL_DOMAINS = ["Technology", "Finance", "Medicine", "Tennis", "Literature"]


def create_editorial_tasks(scout, writer, publisher):
    selected_domain = random.choice(ALL_DOMAINS)

    SKILL_SPEC = {
        "Finance": {
            "name": "金融投资新闻专业Skill",
            "skill_id": "financial-news-radar",
            "format": "【标题】【核心快讯】【关键数据】【市场影响】【简评】",
        },
        "Medicine": {
            "name": "医学研究新闻专业Skill",
            "skill_id": "pubmed-literature-puller",
            "format": "【研究标题】【发布机构/期刊】【核心发现】【研究方法】【意义与局限】【新闻简评】",
        },
        "Technology": {
            "name": "科技创新新闻专业Skill",
            "skill_id": "tech-trend-radar",
            "format": "【科技热点】【核心突破/事件】【技术解读】【产业影响】【未来趋势】",
        },
        "Tennis": {
            "name": "网球体育新闻 Skill",
            "skill_id": "atp-wta-live-score",
            "format": "【赛事】【赛果】【关键数据】【比赛亮点】【简评】",
        },
        "Literature": {
            "name": "艺术文学音乐新闻 Skill",
            "skill_id": "literary-critic",
            "format": "【文化热点】【内容简介】【风格/主题解析】【影响与评价】【简短评论】",
        },
    }

    spec = SKILL_SPEC[selected_domain]
    print(f"📡 任务生成 | 领域: {selected_domain} | 执行记者: {writer.role}")

    s_task = Task(
        description=(
            f"1. 先调用搜索引擎查找关于 {selected_domain} 的【今日真实新闻】。\n"
            f"2. 作为【{spec['name']}】，启动 Skill: {spec['skill_id']} 读取原始事实 ({today})。\n"
            f"3. 要求：必须包含至少 2 个硬核数据（如金额、百分比、DOI 或机构名）。\n"
            f"4. 严禁编造网址！如果找不到今天的新闻，就寻找最近 48 小时内的动态。"
        ),
        expected_output=f"=== {selected_domain.upper()}_RAW ===\n严格符合以下格式的原始素材：\n{spec['format']}",
        agent=scout,
    )

    target_lang = "简体中文" if "中文" in writer.role or "Neon" in writer.role else "English"
    w_task = Task(
        description=(
            "基于素材，作为 FT 资深特派员撰写一篇快讯或深度文章。\n"
            "1. 禁止列清单，必须采用叙事体。第一段必须是强有力的导语（Lead）。\n"
            "2. 融入数据：将硬核数据自然编织在句中，而非列在文末。\n"
            "3. FT 文风：保持冷静、冷峻的专业口吻。\n"
            f"4. 语言约束：必须严格使用【{target_lang}】输出。"
        ),
        expected_output=(
            f"一篇完美的 {selected_domain} 行业报道。格式：\n"
            "[标题]\n"
            "[副标题]\n"
            "[正文，1-4个自然段]"
        ),
        agent=writer,
        context=[s_task],
    )

    p_task = Task(
        description=(
            f"你必须执行动作将稿件存入数据库。\n"
            f"1. 接收来自 {writer.role} 生成的内容。\n"
            "2. 判定语种：中文设 language='zh'，英文设 language='en'。\n"
            f"3. 分类设为 category='{selected_domain}'。\n"
            "4. 调用 `post_to_guava_api_tool` 工具，传入构造好的 JSON 字符串。\n"
            "5. 严禁只在 Final Answer 回复 JSON。必须看到 Action 执行并成功。"
        ),
        expected_output="数据库返回的 Success 确认信息。",
        agent=publisher,
        context=[w_task],
    )

    return [s_task, w_task, p_task]
