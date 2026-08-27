import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

import { unzipSync } from "fflate";

import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const PPT_MIME = "application/vnd.ms-powerpoint";

const decodeXmlEntities = (value: string): string =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/**
 * 从 PPTX（ZIP 容器）中提取每张幻灯片的文本：
 * 解压后读取 ppt/slides/slideN.xml，抽取所有 <a:t> 文本 run，按幻灯片顺序拼接。
 */
const extractPptxText = (buffer: Buffer): string => {
  const zip = unzipSync(new Uint8Array(buffer));
  const slideNames = Object.keys(zip)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(/slide(\d+)\.xml/.exec(a)?.[1] ?? 0);
      const nb = Number(/slide(\d+)\.xml/.exec(b)?.[1] ?? 0);
      return na - nb;
    });

  const slides: string[] = [];
  const textRunRe = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
  for (const name of slideNames) {
    const xml = new TextDecoder().decode(zip[name]);
    // 自闭合 <a:t/> 表示空文本，先剔除避免影响匹配
    const cleaned = xml.replace(/<a:t[^>]*\/>/g, "");
    const runs: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = textRunRe.exec(cleaned)) !== null) {
      const run = decodeXmlEntities(match[1]).trim();
      if (run) runs.push(run);
    }
    if (runs.length > 0) slides.push(runs.join(" "));
  }
  return slides.join("\n\n");
};

export class DocumentParsingService {
  async parseDocument(file: Express.Multer.File): Promise<string> {
    let text = "";

    if (file.mimetype === "application/pdf") {
      try {
        const originalName = Buffer.from(
          file.originalname,
          "latin1",
        ).toString("utf8");

        let data;
        if (typeof pdfParse === "function") {
          data = await pdfParse(file.buffer);
        } else if (pdfParse.PDFParse) {
          const parser = new pdfParse.PDFParse({ data: file.buffer });
          const result = await parser.getText();
          data = {
            text: result.text,
            numpages: result.numpages || 0,
            info: result.info,
          };
        } else {
          throw new AppError(ErrorCodes.UNSUPPORTED_FORMAT, { message: "Unsupported pdf-parse version/structure" });
        }

        text = data.text;

        logger.info("PDF Extraction Result", {
          fileName: originalName,
          pageCount: data.numpages,
          textLength: text?.length || 0,
        });
      } catch (pdfErr: unknown) {
        const err = pdfErr as Error;
        logger.error("PDF Parse detailed error:", pdfErr);
        throw new AppError(
          `PDF parsing failed: ${err.message}`,
          500,
          ErrorCodes.SYSTEM_INTERNAL_ERROR,
        );
      }
    } else if (
      file.mimetype === PPTX_MIME ||
      file.originalname.toLowerCase().endsWith(".pptx")
    ) {
      try {
        text = extractPptxText(file.buffer);
        logger.info("PPTX Extraction Result", {
          fileName: file.originalname,
          textLength: text.length,
        });
      } catch (pptxErr: unknown) {
        const err = pptxErr as Error;
        logger.error("PPTX Parse detailed error:", pptxErr);
        throw new AppError(
          `PPTX parsing failed: ${err.message}`,
          500,
          ErrorCodes.SYSTEM_INTERNAL_ERROR,
        );
      }
    } else if (
      file.mimetype === PPT_MIME ||
      file.originalname.toLowerCase().endsWith(".ppt")
    ) {
      throw new AppError(
        "暂不支持旧版 .ppt 二进制格式，请另存为 .pptx 后重试",
        400,
        ErrorCodes.UNSUPPORTED_FORMAT,
      );
    } else {
      text = file.buffer.toString("utf-8");
      logger.info("Text/MD Extraction Result", {
        fileName: file.originalname,
        textLength: text.length,
      });
    }

    return text;
  }
}

export const documentParsingService = new DocumentParsingService();
