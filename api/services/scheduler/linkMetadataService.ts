/**
 * 链接元数据识别：抓取 URL 解析页面标题/描述，供前端「快速链接」拖拽自动识别使用。
 * - 仅允许 http/https，并对内网/环回地址做 SSRF 防护。
 * - 抓取带超时与响应体大小上限。
 */
import { logger } from "../../utils/logger";

export interface LinkMetadata {
  title: string;
  description: string;
}

const MAX_BYTES = 200 * 1024;
const TIMEOUT_MS = 6000;

/** 判定为内网/危险地址的 IP 段 */
function isBlockedIp(hostname: string): boolean {
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!ipv4) return false;
  const [, aRaw, b, c] = ipv4;
  const a = Number(aRaw);
  const bN = Number(b);
  const cN = Number(c);
  if (a >= 224) return true;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && bN === 254) return true;
  if (a === 172 && bN >= 16 && bN <= 31) return true;
  if (a === 192 && bN === 168) return true;
  if (a === 100 && bN >= 64 && bN <= 127) return true;
  void cN;
  return false;
}

function isRiskyUrl(input: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  const host = parsed.hostname;
  if (!host) return true;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }
  if (isBlockedIp(host)) return true;
  return false;
}

/** 提取 <meta>/og 字段，兼容属性顺序 */
function extractMeta(html: string, key: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*>|<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const m = re.exec(html);
  if (!m) return undefined;
  // 优先取 content 属性；若 capture 组1存在则用之
  let content: string | undefined = m[1];
  if (!content) {
    const c = /content=["']([^"']*)["']/i.exec(m[0]);
    content = c ? c[1] : undefined;
  }
  return content;
}

function decodeEntities(input: string): string | undefined {
  const out = input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
  return out || undefined;
}

function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function deriveFallbackDescription(html: string): string {
  const text = stripTags(html);
  return text.slice(0, 180);
}

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  if (isRiskyUrl(url)) {
    return { title: "", description: "" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; KnowledgeMap/1.0; link-metadata)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return { title: "", description: "" };

    const buffer = await res.arrayBuffer();
    const html = Buffer.from(buffer.slice(0, MAX_BYTES)).toString("utf8");

    let title =
      extractMeta(html, "og:title") || extractMeta(html, "twitter:title");
    if (!title) {
      const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
      title = t ? stripTags(t[1]) : "";
    }
    let description =
      extractMeta(html, "og:description") || extractMeta(html, "description");
    if (!description) description = deriveFallbackDescription(html);

    return {
      title: decodeEntities(title || "") || "",
      description: decodeEntities(description || "") || "",
    };
  } catch (error) {
    logger.warn("[LinkMetadata] fetch failed", {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return { title: "", description: "" };
  } finally {
    clearTimeout(timer);
  }
}