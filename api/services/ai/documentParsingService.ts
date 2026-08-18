import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

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
