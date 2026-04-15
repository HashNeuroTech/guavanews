import requests
import json


def post_to_guava_api(data):
    """发布工具：支持解析 JSON 字符串并写入后端。"""
    url = "http://127.0.0.1:8000/api/articles"

    try:
        if isinstance(data, str):
            clean_content = data.replace("```json", "").replace("```", "").strip()
            start = clean_content.find("[")
            end = clean_content.rfind("]") + 1
            if start != -1 and end != 0:
                clean_content = clean_content[start:end]
            payload = json.loads(clean_content)
        else:
            payload = data

        results = []
        if isinstance(payload, list):
            for item in payload:
                res = requests.post(url, json=item, timeout=30)
                results.append(res.status_code)
        else:
            res = requests.post(url, json=payload, timeout=30)
            results.append(res.status_code)

        if all(code == 200 for code in results):
            return f"✅ 成功存入数据库！发布了 {len(results)} 篇文章。"
        return f"⚠️ 部分发布失败，状态码列表: {results}"

    except json.JSONDecodeError as e:
        return f"🚨 JSON 解析失败: {str(e)}"
    except Exception as e:
        return f"🚨 传输异常: {str(e)}"
