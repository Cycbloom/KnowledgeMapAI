import { BaseAIProvider } from './base.js';
import { AIProviderConfig } from '../types.js';
import { logger } from '../../../utils/logger.js';

export class AliyunProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super('aliyun', config);
  }

  async synthesizeSpeech(text: string, voice: string = 'Cherry', speed: number = 1.0, format: string = 'mp3'): Promise<Buffer> {
    if (!this.hasKey) {
        throw new Error('Aliyun API Key is missing');
    }

    // Split text if it's too long (> 300 chars)
    const MAX_CHUNK_LENGTH = 300;
    if (text.length > MAX_CHUNK_LENGTH) {
        return this.synthesizeLongText(text, voice, speed, format);
    }

    return this.synthesizeChunk(text, voice, speed, format);
  }

  private async synthesizeLongText(text: string, voice: string, speed: number, format: string): Promise<Buffer> {
    const chunks = this.splitText(text);
    logger.info(`Splitting TTS text into ${chunks.length} chunks`);

    // Force WAV for reliable concatenation, regardless of requested format
    // MP3 concatenation is unreliable without re-encoding (headers/metadata issues)
    const internalFormat = 'wav';

    // Process chunks in parallel with concurrency limit
    const CONCURRENCY = 3;
    const results: Buffer[] = new Array(chunks.length);
    
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const batch = chunks.slice(i, i + CONCURRENCY);
        const batchPromises = batch.map(async (chunk, index) => {
            try {
                const buffer = await this.synthesizeChunk(chunk, voice, speed, internalFormat);
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
    let currentChunk = '';

    for (let i = 0; i < sentences.length; i++) {
        const part = sentences[i];
        if (currentChunk.length + part.length > 300) {
            if (currentChunk && currentChunk.trim().length > 0) chunks.push(currentChunk);
            currentChunk = part;
        } else {
            currentChunk += part;
        }
    }
    if (currentChunk && currentChunk.trim().length > 0) chunks.push(currentChunk);
    
    // Filter out chunks that are just punctuation or too short to be meaningful
    return chunks.filter(c => {
        const trimmed = c.trim();
        // Check if it has at least one non-punctuation character or is long enough
        return trimmed.length > 0 && /[a-zA-Z0-9\u4e00-\u9fa5]/.test(trimmed);
    });
  }

  private mergeAudioBuffers(buffers: Buffer[], format: string): Buffer {
    if (buffers.length === 0) return Buffer.alloc(0);
    if (buffers.length === 1) return buffers[0];

    if (format === 'wav') {
        // WAV Header Handling
        // Keep first header, strip headers from others (assume 44 bytes), update sizes
        const firstBuffer = buffers[0];
        const otherBuffers = buffers.slice(1).map(b => b.subarray(44)); // Strip 44-byte header
        
        const totalDataLength = firstBuffer.length - 44 + otherBuffers.reduce((sum, b) => sum + b.length, 0);
        const result = Buffer.concat([firstBuffer.subarray(0, 44), firstBuffer.subarray(44), ...otherBuffers]);
        
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

  private async synthesizeChunk(text: string, voice: string, speed: number, format: string): Promise<Buffer> {
    // Use the specific model requested by user
    const model = 'qwen3-tts-flash'; 
    
    // DashScope Multimodal API for Qwen3-TTS
    // Ref: https://help.aliyun.com/zh/model-studio/developer-reference/text-to-speech-qwen3-tts-flash
    const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.client.apiKey}`,
                'Content-Type': 'application/json'
                // 'X-DashScope-Async': 'enable' // Removed to fix AccessDenied
            },
            body: JSON.stringify({
                model,
                input: {
                    text,
                    voice,
                    language_type: 'Chinese' // Default to Chinese context as per user preference
                },
                parameters: {
                    // Qwen3-TTS might not support all these, but standard DashScope usually allows them in parameters
                    rate: speed, 
                    format
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Aliyun TTS failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        
        let audioUrl = '';
        if (data.audio && data.audio.url) {
            audioUrl = data.audio.url;
        } else if (data.output && data.output.audio && data.output.audio.url) {
             audioUrl = data.output.audio.url;
        } else {
             // Fallback/Error
             logger.error('Unexpected Aliyun TTS response format:', data);
             throw new Error('Aliyun TTS response missing audio URL');
        }

        // Fetch the actual audio binary
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
            throw new Error(`Failed to download audio from URL: ${audioResponse.statusText}`);
        }
        
        const arrayBuffer = await audioResponse.arrayBuffer();
        return Buffer.from(arrayBuffer);

    } catch (error: any) {
        logger.error('Aliyun TTS Error:', error);
        throw error;
    }
  }
}
