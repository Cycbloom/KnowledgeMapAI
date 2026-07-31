import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";

export interface NoteWordCount {
  wordCount: number;
  readingMinutes: number;
}

export function useNoteWordCount(editor: Editor | null): NoteWordCount {
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    if (!editor) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const recalculate = () => {
      const text = editor.state.doc.textContent ?? "";
      // CJK characters (each counts as 1 word) + English words (split by whitespace)
      const cjkMatches = text.match(
        /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g,
      );
      const cjkCount = cjkMatches ? cjkMatches.length : 0;
      // Remove CJK chars, then split the rest by whitespace and count non-empty tokens
      const nonCjkText = text.replace(
        /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g,
        " ",
      );
      const englishWords = nonCjkText
        .split(/\s+/)
        .filter((w) => w.length > 0);
      const total = cjkCount + englishWords.length;
      setWordCount(total);
    };

    const debouncedRecalculate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(recalculate, 300);
    };

    recalculate(); // initial
    editor.on("update", debouncedRecalculate);

    return () => {
      editor.off("update", debouncedRecalculate);
      if (timer) clearTimeout(timer);
    };
  }, [editor]);

  const readingMinutes =
    wordCount === 0 ? 0 : Math.max(1, Math.ceil(wordCount / 300));

  return { wordCount, readingMinutes };
}