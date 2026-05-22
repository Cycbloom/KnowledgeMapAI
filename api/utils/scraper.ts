import axios from "axios";
import * as cheerio from "cheerio";
import { Logger } from "./logger";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";

const logger = new Logger("Scraper");

const BLOCKED_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^0\.0\.0\.0/,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^localhost$/i,
];

const ALLOWED_PROTOCOLS = ["http:", "https:"];

function isBlockedIP(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase();

  for (const pattern of BLOCKED_IP_RANGES) {
    if (pattern.test(lowerHostname)) {
      return true;
    }
  }

  return false;
}

function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsedUrl = new URL(url);

    if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
      return { valid: false, error: `不支持的协议: ${parsedUrl.protocol}` };
    }

    const hostname = parsedUrl.hostname;

    if (isBlockedIP(hostname)) {
      return { valid: false, error: "禁止访问内网地址" };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: "无效的 URL 格式" };
  }
}

export async function scrapeUrl(
  url: string,
): Promise<{ title: string; text: string }> {
  const validation = validateUrl(url);

  if (!validation.valid) {
    logger.warn(`SSRF blocked: ${url} - ${validation.error}`);
    throw new AppError(ErrorCodes.SSRF_BLOCKED, {
      message: validation.error || "URL 访问被阻止",
    });
  }

  try {
    logger.info(`Scraping URL: ${url}`);

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // 2. Remove clutter
    $(
      "script, style, nav, footer, iframe, noscript, .ad, .advertisement, .social-share, .comments",
    ).remove();

    // 3. Extract Title
    const title =
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      "Untitled Page";

    // 4. Extract Main Content
    // Heuristic: Try common article selectors first, fallback to body
    let content = "";
    const selectors = [
      "article",
      "main",
      ".post-content",
      ".article-content",
      "#content",
      ".content",
      "body",
    ];

    for (const selector of selectors) {
      if ($(selector).length > 0) {
        // Get text with some formatting preserved (paragraphs)
        // We iterate over paragraphs to keep structure
        const paragraphs: string[] = [];
        $(selector)
          .find("p, h1, h2, h3, h4, h5, li")
          .each((_, el) => {
            const text = $(el).text().trim();
            if (text.length > 20) {
              // Filter out tiny snippets
              paragraphs.push(text);
            }
          });

        if (paragraphs.length > 5) {
          content = paragraphs.join("\n\n");
          break;
        }
      }
    }

    // Fallback: Just grab all text if structured extraction failed
    if (!content) {
      content = $("body").text().replace(/\s+/g, " ").trim();
    }

    // Truncate if too huge (AI context limit protection)
    if (content.length > 50000) {
      content = `${content.substring(0, 50000)}... (truncated)`;
    }

    logger.info(`Scraped ${content.length} chars from ${url}`);
    return { title, text: content };
  } catch (error: unknown) {
    logger.error(`Failed to scrape URL ${url}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`无法访问该网页: ${errorMessage}`);
  }
}
