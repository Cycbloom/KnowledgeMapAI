export interface NormalizableGeneratedCard {
  type?: unknown;
  answer?: unknown;
  options?: unknown;
  [key: string]: unknown;
}

interface CanonicalOption {
  raw: string;
  canon: string;
}

const OPTION_BASED_TYPES = new Set(["choice", "multi_choice", "select_from_options"]);

const canonicalize = (text: string): string => text.replace(/\s+/g, "").toLowerCase();

function extractOptionTexts(raw: unknown): string[] | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value)) return null;
  const texts = value.filter(
    (o): o is string => typeof o === "string" && o.trim().length > 0,
  );
  return texts.length > 0 ? texts : null;
}

function letterToIndex(letter: string): number {
  const code = letter.toUpperCase().charCodeAt(0);
  if (code < 65 || code > 90) return -1;
  return code - 65;
}

function findOptionByText(text: string, canonicalOptions: CanonicalOption[]): string | null {
  const canon = canonicalize(text);
  if (!canon) return null;
  return canonicalOptions.find((o) => o.canon === canon)?.raw ?? null;
}

function indexToOption(index: number, options: string[]): string | null {
  if (index >= 0 && index < options.length) return options[index];
  return null;
}

function resolveOptionReference(
  raw: string,
  options: string[],
  canonicalOptions: CanonicalOption[],
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const asText = findOptionByText(trimmed, canonicalOptions);
  if (asText !== null) return asText;

  if (/^[a-zA-Z]$/.test(trimmed)) {
    return indexToOption(letterToIndex(trimmed), options);
  }

  const prefixMatch = trimmed.match(/^\(?\s*([a-zA-Z])\s*\)?\s*[).、．,，:：]\s*(.+)$/);
  if (prefixMatch) {
    const restHit = findOptionByText(prefixMatch[2], canonicalOptions);
    if (restHit !== null) return restHit;
    const idx = letterToIndex(prefixMatch[1]);
    if (idx >= 0 && idx < options.length) return options[idx];
    return null;
  }

  const cnLabelMatch = trimmed.match(/^选项\s*([a-zA-Z])$/);
  if (cnLabelMatch) {
    return indexToOption(letterToIndex(cnLabelMatch[1]), options);
  }

  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    if (n >= 1 && n <= options.length) return options[n - 1];
    if (n === 0) return indexToOption(0, options);
  }

  return null;
}

function splitLooseList(text: string): string[] {
  const parts = text
    .split(/[,，、;；]/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text];
}

function normalizeMultiChoiceAnswer(
  answer: unknown,
  options: string[],
  canonicalOptions: CanonicalOption[],
): unknown {
  let items: unknown[];
  if (Array.isArray(answer)) {
    items = answer;
  } else if (typeof answer === "string") {
    const trimmed = answer.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        items = Array.isArray(parsed) ? parsed : splitLooseList(trimmed);
      } catch {
        items = splitLooseList(trimmed);
      }
    } else {
      items = splitLooseList(trimmed);
    }
  } else {
    return answer;
  }

  const mapped = items.map((item) => {
    if (typeof item !== "string") return item;
    return resolveOptionReference(item, options, canonicalOptions) ?? item.trim();
  });
  return JSON.stringify(mapped);
}

export function normalizeGeneratedCardAnswers<T extends NormalizableGeneratedCard>(
  cards: T[],
): T[] {
  for (const card of cards) {
    const type = typeof card.type === "string" ? card.type : "";
    if (!OPTION_BASED_TYPES.has(type)) continue;

    const options = extractOptionTexts(card.options);
    if (!options) continue;
    const canonicalOptions: CanonicalOption[] = options.map((raw) => ({
      raw,
      canon: canonicalize(raw),
    }));

    if (type === "multi_choice") {
      card.answer = normalizeMultiChoiceAnswer(card.answer, options, canonicalOptions);
      continue;
    }

    if (typeof card.answer === "string") {
      const resolved = resolveOptionReference(card.answer, options, canonicalOptions);
      if (resolved !== null) card.answer = resolved;
    } else if (typeof card.answer === "number") {
      const resolved = resolveOptionReference(String(card.answer), options, canonicalOptions);
      if (resolved !== null) card.answer = resolved;
    }
  }
  return cards;
}
