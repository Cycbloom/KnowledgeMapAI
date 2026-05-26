const CHUNK_SIZE = 400;
const OVERLAP = 50;

export interface ChunkResult {
  content: string;
  index: number;
}

export class ChunkingService {
  chunkText(
    text: string,
    options?: { chunkSize?: number; overlap?: number }
  ): ChunkResult[] {
    const chunkSize = options?.chunkSize ?? CHUNK_SIZE;
    const overlap = options?.overlap ?? OVERLAP;

    if (!text || text.trim().length === 0) {
      return [];
    }

    if (text.length <= chunkSize) {
      return [{ content: text, index: 0 }];
    }

    const paragraphs = text.split(/\n\n+/);
    const chunks: ChunkResult[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      if (paragraph.length > chunkSize) {
        if (currentChunk.trim().length > 0) {
          chunks.push({ content: currentChunk.trim(), index: chunkIndex });
          chunkIndex++;
          currentChunk = this.getOverlapText(currentChunk, overlap);
        }

        const sentenceChunks = this.chunkBySentences(paragraph, chunkSize, overlap);
        for (const sentenceChunk of sentenceChunks) {
          const combined = currentChunk.trim().length > 0
            ? currentChunk.trim() + '\n\n' + sentenceChunk
            : sentenceChunk;

          if (combined.length <= chunkSize) {
            currentChunk = combined;
          } else {
            if (currentChunk.trim().length > 0) {
              chunks.push({ content: currentChunk.trim(), index: chunkIndex });
              chunkIndex++;
            }
            currentChunk = sentenceChunk;
          }
        }
      } else {
        const combined = currentChunk.trim().length > 0
          ? currentChunk.trim() + '\n\n' + paragraph
          : paragraph;

        if (combined.length <= chunkSize) {
          currentChunk = combined;
        } else {
          if (currentChunk.trim().length > 0) {
            chunks.push({ content: currentChunk.trim(), index: chunkIndex });
            chunkIndex++;
            currentChunk = this.getOverlapText(currentChunk, overlap) + '\n\n' + paragraph;
          } else {
            currentChunk = paragraph;
          }
        }
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({ content: currentChunk.trim(), index: chunkIndex });
    }

    return chunks;
  }

  private chunkBySentences(text: string, chunkSize: number, overlap: number): string[] {
    const sentences = text.split(/(?<=[.!?。！？])\s*/);
    const result: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if (sentence.length === 0) continue;

      if (current.length + sentence.length + 1 <= chunkSize) {
        current = current.length > 0 ? current + ' ' + sentence : sentence;
      } else {
        if (current.length > 0) {
          result.push(current.trim());
          current = this.getOverlapText(current, overlap) + ' ' + sentence;
        } else {
          current = sentence;
        }
      }
    }

    if (current.trim().length > 0) {
      result.push(current.trim());
    }

    return result;
  }

  private getOverlapText(text: string, overlap: number): string {
    if (overlap <= 0 || text.length <= overlap) return '';
    return text.slice(-overlap);
  }
}

export const chunkingService = new ChunkingService();
