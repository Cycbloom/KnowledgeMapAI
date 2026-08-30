"""以真实 owner 身份打开 KnowledgeMap Web 应用（供 AI / 代理调试用）。

背景：应用是单用户自动登录。全新 Playwright 上下文没有 localStorage 凭证，
会走 provisionOwner() 自动创建了一个空的临时 owner 账号，看不到真实数据。
本脚本在页面加载前把 .dev-owner-credentials.json（已 gitignore）里的真实
owner 凭证预注入 localStorage['km-owner-credentials']，应用既有的
silentSignIn 静默重登链路会自动登录成真实 owner，展示全部真实数据。
零应用代码改动。

该文件由应用在开发期「自动创建新 owner 时」经过
POST /api/v1/owner-credentials 自动同步（见 src/utils/silentAuth.ts）。
用法：
    python scripts/webapp_login.py                    # 有头浏览器，保持打开
    python scripts/webapp_login.py --headless \
        --screenshot /tmp/owner_home.png --base-url http://localhost:5173/
    python scripts/webapp_login.py --help

也可作为模块导入，复用 open_owner_page()。
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

from playwright.sync_api import Browser, Page, sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
CRED_FILE = ROOT / ".dev-owner-credentials.json"
DEFAULT_URL = "http://localhost:5173/"


def load_owner_credentials() -> dict[str, str]:
    """读取 .dev-owner-credentials.json，返回 {email, password}。

    该文件由应用在开发期自动创建/重登 owner 时经
    POST /api/v1/owner-credentials 自动同步，保持与「实际登录账号」一致。
    若缺少文件，运行一次应用登录（或 db reset 后开应用）即可生成。
    """
    if not CRED_FILE.exists():
        sys.exit(
            f"credentials file not found: {CRED_FILE}\n"
            "它在应用开发期登录时自动生成；请先启动应用让它同步一次。"
        )
    try:
        creds = json.loads(CRED_FILE.read_text(encoding="utf-8"))
        email, password = creds["email"], creds["password"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        sys.exit(f"malformed credentials in {CRED_FILE}: {exc}")
    if not email or not password:
        sys.exit(f"empty credentials in {CRED_FILE}")
    return {"email": email, "password": password}


def owner_bootstrap_js(creds: dict[str, str]) -> str:
    """生成在页面加载前注入 localStorage 的 JS，绕过 provisionOwner。"""
    raw = json.dumps({"email": creds["email"], "password": creds["password"]})
    # raw 已是合法 JSON 字符串；再套一层 json.dumps 输出为 JS 双引号字符串字面量
    return f"localStorage.setItem('km-owner-credentials', {json.dumps(raw)});"


def open_owner_page(
    browser: Browser,
    base_url: str = DEFAULT_URL,
    *,
    credentials: dict[str, str] | None = None,
) -> Page:
    """打开已认证为真实 owner 的页面。

    - 新上下文 + preload init script 注入凭证（在 App 模块加载前执行）
    - 导航后应用自动进入首页（silentSignIn 静默重登）
    """
    creds = credentials or load_owner_credentials()
    context = browser.new_context()
    context.add_init_script(owner_bootstrap_js(creds))
    page = context.new_page()
    page.goto(base_url, wait_until="domcontentloaded")
    # 等 auth token 落盘 localStorage（与应用 authedRequest 相同的判定依据），
    # 证明静默登录已完成、session 已恢复到 Zustand store（最长 15s）
    try:
        page.wait_for_function(
            "() => {"
            "  const raw = localStorage.getItem('km-auth');"
            "  if (!raw) return false;"
            "  try { const s = JSON.parse(raw)?.state; return !!s?.token; }"
            "  catch { return false; }"
            "}",
            timeout=15000,
        )
    except Exception:  # noqa: BLE001 - 超时仅提示，不强制失败；登录态仍以截图确认
        print("[webapp_login] warned: auth token not detected within 15s", file=sys.stderr)
    # 登录后让仪表盘数据接口完成加载，避免截图停留在 0 状态
    page.wait_for_timeout(1500)
    return page


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base-url", default=DEFAULT_URL, help="Web 应用地址")
    parser.add_argument(
        "--headless",
        action="store_true",
        help="无头模式（适合代理/CI 截图）",
    )
    parser.add_argument(
        "--screenshot",
        metavar="PATH",
        default=None,
        help="截图保存路径（配合 --headless 使用）",
    )
    args = parser.parse_args()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=args.headless)
        try:
            page = open_owner_page(browser, args.base_url)
            if args.screenshot:
                page.wait_for_load_state("networkidle")
                page.screenshot(path=args.screenshot, full_page=True)
                print(f"[webapp_login] screenshot saved to {args.screenshot}")
                return
            # 有头模式：保持浏览器打开供交互，直到被关闭
            print(
                "[webapp_login] opened as real owner — keep this browser open for "
                "debugging. Press Ctrl+C in the terminal to quit."
            )
            page.wait_for_timeout(60 * 60 * 24)  # 保持打开
        finally:
            browser.close()


if __name__ == "__main__":
    main()