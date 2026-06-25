import { BaseAIProvider } from "./base";
import type { AIProviderConfig } from "@shared/types";
import { logger } from "../../../utils/logger";
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCodes } from "../../../../shared/types/errorCodes";
import { WebSocket } from "ws";
import { randomUUID } from "crypto";

export class AliyunProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super("aliyun", config);
  }

  async synthesizeSpeech(
    text: string,
    voice: string = "sambert-zhide-v1",
    speed: number = 1.0,
    format: string = "mp3",
  ): Promise<Buffer> {
    if (!this.hasKey) {
      throw new AppError(ErrorCodes.AI_SERVICE_UNAVAILABLE);
    }

    // Split text if it's too long (> 300 chars)
    const MAX_CHUNK_LENGTH = 300;
    if (text.length > MAX_CHUNK_LENGTH) {
      return this.synthesizeLongText(text, voice, speed, format);
    }

    return this.synthesizeChunk(text, voice, speed, format);
  }

  async transcribeSpeech(
    audioBuffer: Buffer,
    options?: { language?: string; format?: string },
  ): Promise<{ text: string; language?: string; duration?: number }> {
    if (!this.hasKey) {
      throw new AppError(ErrorCodes.AI_SERVICE_UNAVAILABLE);
    }

    const format = options?.format || "wav";
    const mimeType = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
    const base64Audio = audioBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Audio}`;

    const url = `${this.client.baseURL}/chat/completions`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.client.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen3-asr-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: dataUrl,
                },
              ],
            },
          ],
          asr_options: options?.language
            ? { language: options.language }
            : undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `Aliyun STT failed: ${response.status} ${response.statusText} - ${errorText}`,
        });
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        request_id?: string;
      };

      const text = data.choices?.[0]?.message?.content || "";
      if (!text) {
        logger.error("Unexpected Aliyun STT response format:", data);
        throw new AppError(ErrorCodes.AI_INVALID_RESPONSE);
      }

      return {
        text,
        language: options?.language,
      };
    } catch (error: unknown) {
      logger.error("Aliyun STT Error:", error);
      if (error instanceof AppError) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: errorMessage || "Aliyun STT error",
      });
    }
  }

  private async synthesizeLongText(
    text: string,
    voice: string,
    speed: number,
    _format: string,
  ): Promise<Buffer> {
    const chunks = this.splitText(text);
    logger.info(`Splitting TTS text into ${chunks.length} chunks`);

    // Force WAV for reliable concatenation, regardless of requested format
    // MP3 concatenation is unreliable without re-encoding (headers/metadata issues)
    const internalFormat = "wav";

    // Process chunks in parallel with concurrency limit
    const CONCURRENCY = 3;
    const results: Buffer[] = new Array(chunks.length);

    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const batch = chunks.slice(i, i + CONCURRENCY);
      const batchPromises = batch.map(async (chunk, index) => {
        try {
          const buffer = await this.synthesizeChunk(
            chunk,
            voice,
            speed,
            internalFormat,
          );
          results[i + index] = buffer;
        } catch (err) {
          logger.error(`Failed to synthesize chunk ${i + index}:`, err);
          throw err;
        }
      });
      await Promise.all(batchPromises);
    }

    return this.mergeAudioBuffers(results, internalFormat);
  }

  private splitText(text: string): string[] {
    // Split by sentence terminators
    const sentences = text.split(/([.!?。！？\n]+)/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (let i = 0; i < sentences.length; i++) {
      const part = sentences[i];
      if (currentChunk.length + part.length > 300) {
        if (currentChunk && currentChunk.trim().length > 0)
          chunks.push(currentChunk);
        currentChunk = part;
      } else {
        currentChunk += part;
      }
    }
    if (currentChunk && currentChunk.trim().length > 0)
      chunks.push(currentChunk);

    // Filter out chunks that are just punctuation or too short to be meaningful
    return chunks.filter((c) => {
      const trimmed = c.trim();
      // Check if it has at least one non-punctuation character or is long enough
      return trimmed.length > 0 && /[a-zA-Z0-9\u4e00-\u9fa5]/.test(trimmed);
    });
  }

  private mergeAudioBuffers(buffers: Buffer[], format: string): Buffer {
    if (buffers.length === 0) return Buffer.alloc(0);
    if (buffers.length === 1) return buffers[0];

    if (format === "wav") {
      // WAV Header Handling
      // Keep first header, strip headers from others (assume 44 bytes), update sizes
      const firstBuffer = buffers[0];
      const otherBuffers = buffers.slice(1).map((b) => b.subarray(44)); // Strip 44-byte header

      const totalDataLength =
        firstBuffer.length -
        44 +
        otherBuffers.reduce((sum, b) => sum + b.length, 0);
      const result = Buffer.concat([
        firstBuffer.subarray(0, 44),
        firstBuffer.subarray(44),
        ...otherBuffers,
      ]);

      // Update ChunkSize (Offset 4) = 36 + SubChunk2Size
      result.writeUInt32LE(36 + totalDataLength, 4);
      // Update Subchunk2Size (Offset 40) = NumSamples * NumChannels * BitsPerSample/8
      result.writeUInt32LE(totalDataLength, 40);

      return result;
    } else {
      // MP3 can usually be concatenated directly
      return Buffer.concat(buffers);
    }
  }

  private async synthesizeChunk(
    text: string,
    voice: string,
    speed: number,
    format: string,
  ): Promise<Buffer> {
    const model = voice || "sambert-zhide-v1";
    const baseURL =
      this.client.baseURL ||
      "https://dashscope.aliyuncs.com/compatible-mode/v1";
    const wsUrl = baseURL
      .replace("https://", "wss://")
      .replace("http://", "ws://")
      .replace("/compatible-mode/v1", "/api-ws/v1/inference");

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const taskId = randomUUID();
      let settled = false;
      let binaryCount = 0;

      logger.info(
        `[Sambert TTS] Connecting to ${wsUrl}, model=${model}, format=${format}, text="${text.substring(0, 50)}"`,
      );

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          ws.close();
          reject(
            new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
              message: "Sambert TTS timeout (30s)",
            }),
          );
        }
      }, 30000);

      const ws = new WebSocket(wsUrl, {
        headers: { Authorization: `Bearer ${this.client.apiKey}` },
      });

      ws.on("open", () => {
        logger.info(`[Sambert TTS] WebSocket connected, sending run-task`);
        ws.send(
          JSON.stringify({
            header: {
              action: "run-task",
              task_id: taskId,
              streaming: "out",
            },
            payload: {
              task_group: "audio",
              task: "tts",
              function: "SpeechSynthesizer",
              model,
              input: { text },
              parameters: {
                text_type: "PlainText",
                format,
                sample_rate: 16000,
                rate: speed,
                volume: 50,
              },
            },
          }),
        );
      });

      ws.on("message", (data: Buffer, isBinary: boolean) => {
        if (settled) return;
        if (isBinary) {
          binaryCount++;
          chunks.push(Buffer.from(data));
          return;
        }
        try {
          const msg = JSON.parse(data.toString()) as {
            header?: {
              event?: string;
              error_message?: string;
            };
          };
          const event = msg.header?.event;
          if (event === "task-finished") {
            settled = true;
            clearTimeout(timeout);
            const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
            logger.info(
              `[Sambert TTS] task-finished: ${binaryCount} binary frames, ${totalSize} bytes total`,
            );
            ws.close();
            resolve(Buffer.concat(chunks));
          } else if (event === "task-failed") {
            settled = true;
            clearTimeout(timeout);
            logger.error(
              `[Sambert TTS] task-failed: ${msg.header?.error_message}`,
            );
            ws.close();
            reject(
              new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
                message: `Sambert TTS failed: ${msg.header?.error_message || "Unknown error"}`,
              }),
            );
          }
        } catch {
          // ignore JSON parse errors for binary audio frames
        }
      });

      ws.on("error", (err: Error) => {
        logger.error(`[Sambert TTS] WebSocket error: ${err.message}`);
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(
            new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
              message: `Sambert TTS WebSocket error: ${err.message}`,
            }),
          );
        }
      });

      ws.on("close", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
          logger.info(
            `[Sambert TTS] WS closed unexpectedly: ${binaryCount} frames, ${totalSize} bytes`,
          );
          if (chunks.length > 0) {
            resolve(Buffer.concat(chunks));
          } else {
            reject(
              new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
                message: "Sambert TTS connection closed without audio data",
              }),
            );
          }
        }
      });
    });
  }
}
