import { logger } from "../../utils/logger";

export interface Term {
  term: string;
  explanation: string;
}

export class AnnotationService {
  parseTermsResponse(aiContent: string): Term[] {
    let terms: Term[] = [];

    try {
      const parsed = JSON.parse(aiContent);
      if (Array.isArray(parsed)) {
        terms = parsed;
      } else if (parsed.terms && Array.isArray(parsed.terms)) {
        terms = parsed.terms;
      } else {
        const values = Object.values(parsed);
        const arrayVal = values.find((v) => Array.isArray(v));
        if (arrayVal) terms = arrayVal as Term[];
      }
    } catch (e) {
      logger.error("Failed to parse annotation terms JSON", {
        aiContent,
        error: e,
      });
    }

    return terms;
  }

  annotateContent(content: string, terms: Term[]): string {
    if (terms.length === 0) return content;

    const placeholders: string[] = [];

    let annotatedContent = content.replace(
      /```[\s\S]*?```|`[^`]*`/g,
      (match: string) => {
        placeholders.push(match);
        return `__CODE_BLOCK_${placeholders.length - 1}__`;
      },
    );

    terms.forEach(({ term, explanation }) => {
      if (!term || !explanation) return;

      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const index = annotatedContent.indexOf(term);
      if (index !== -1) {
        const regex = new RegExp(`(?<!\\[)${escapedTerm}(?!\\]\\(term:)`);
        annotatedContent = annotatedContent.replace(
          regex,
          `[${term}](term:${explanation})`,
        );
      }
    });

    placeholders.forEach((code, i) => {
      annotatedContent = annotatedContent.replace(
        `__CODE_BLOCK_${i}__`,
        () => code,
      );
    });

    return annotatedContent;
  }

  buildTemplateContext(
    topic: string,
    context?: string,
    level?: string,
  ): {
    topic: string;
    context: string;
    isRoot: boolean;
    isNormal: boolean;
    isLeaf: boolean;
  } {
    return {
      topic,
      context: context || "General knowledge",
      isRoot: level === "root" || level === "core",
      isNormal: level === "sub" || level === "normal",
      isLeaf: level === "leaf",
    };
  }
}

export const annotationService = new AnnotationService();
