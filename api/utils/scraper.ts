import axios from 'axios';
import * as cheerio from 'cheerio';
import { Logger } from './logger';

const logger = new Logger('Scraper');

/**
 * Extracts main text content from a URL.
 * Uses Cheerio to parse HTML and heuristics to find the article body.
 */
export async function scrapeUrl(url: string): Promise<{ title: string; text: string; }> {
  try {
    logger.info(`Scraping URL: ${url}`);
    
    // 1. Fetch HTML
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000 // 10s timeout
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // 2. Remove clutter
    $('script, style, nav, footer, iframe, noscript, .ad, .advertisement, .social-share, .comments').remove();

    // 3. Extract Title
    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled Page';

    // 4. Extract Main Content
    // Heuristic: Try common article selectors first, fallback to body
    let content = '';
    const selectors = ['article', 'main', '.post-content', '.article-content', '#content', '.content', 'body'];
    
    for (const selector of selectors) {
      if ($(selector).length > 0) {
        // Get text with some formatting preserved (paragraphs)
        // We iterate over paragraphs to keep structure
        const paragraphs: string[] = [];
        $(selector).find('p, h1, h2, h3, h4, h5, li').each((_, el) => {
           const text = $(el).text().trim();
           if (text.length > 20) { // Filter out tiny snippets
             paragraphs.push(text);
           }
        });
        
        if (paragraphs.length > 5) {
          content = paragraphs.join('\n\n');
          break;
        }
      }
    }

    // Fallback: Just grab all text if structured extraction failed
    if (!content) {
      content = $('body').text().replace(/\s+/g, ' ').trim();
    }

    // Truncate if too huge (AI context limit protection)
    if (content.length > 50000) {
      content = `${content.substring(0, 50000)  }... (truncated)`;
    }

    logger.info(`Scraped ${content.length} chars from ${url}`);
    return { title, text: content };

  } catch (error: any) {
    logger.error(`Failed to scrape URL ${url}`, error);
    throw new Error(`无法访问该网页: ${error.message}`);
  }
}
