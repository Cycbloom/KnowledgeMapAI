import { BaseAIProvider } from './base.js';
import { AIProviderConfig } from '../types.js';

export class VolcengineProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super('volcengine', config);
  }

  // Override to support dimensions parameter for Volcengine embedding
  async createEmbedding(text: string) {
    if (!this.embeddingModel) return null;

    // Check if using the multimodal model
    if (this.embeddingModel.includes('vision') || this.embeddingModel.includes('multimodal')) {
      return this.createMultimodalEmbedding(text);
    }

    // Fallback to standard OpenAI compatible endpoint for other models
    try {
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: text,
        encoding_format: 'float',
        dimensions: 1024, 
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Volcengine embedding error:', error);
      throw error;
    }
  }

  // Special handler for doubao-embedding-vision-251215
  private async createMultimodalEmbedding(text: string) {
    if (!this.embeddingModel) return null;
    
    // Construct the endpoint URL manually since it differs from standard OpenAI
    const endpoint = `${this.client.baseURL}/embeddings/multimodal`;
    
    const payload = {
      model: this.embeddingModel,
      input: [
        {
          type: "text",
          text
        }
      ],
      dimensions: 1024,
      encoding_format: "float",
      multi_embedding: {
        type: "enabled"
      },
      sparse_embedding: {
        type: "enabled"
      }
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.client.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Volcengine API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // Volcengine multimodal format: data is an OBJECT with embedding field, not an array
      if (data && data.data && data.data.embedding) {
        return data.data.embedding;
      } 
      // Fallback for array format if needed
      else if (data && data.data && Array.isArray(data.data) && data.data.length > 0 && data.data[0].embedding) {
        return data.data[0].embedding;
      }
      else {
        console.error('Unexpected response format from Volcengine:', JSON.stringify(data, null, 2));
        return null;
      }
    } catch (error) {
      console.error('Volcengine Multimodal embedding error:', error);
      throw error;
    }
  }
}
