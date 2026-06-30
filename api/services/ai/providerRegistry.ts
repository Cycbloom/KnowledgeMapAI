import type { AIProviderType, AIProviderConfig, AIProvider } from "@shared/types";

type ProviderConstructor = new (config: AIProviderConfig) => AIProvider;

interface ProviderRegistration {
  ProviderClass: ProviderConstructor;
  defaultConfig: AIProviderConfig;
}

class ProviderRegistry {
  private registry = new Map<string, ProviderRegistration>();

  register(type: AIProviderType, ProviderClass: ProviderConstructor, defaultConfig: AIProviderConfig): void {
    this.registry.set(type, { ProviderClass, defaultConfig });
  }

  create(type: AIProviderType, config?: Partial<AIProviderConfig>): AIProvider {
    const registration = this.registry.get(type);
    if (!registration) {
      throw new Error(`Unsupported AI Provider: ${type}`);
    }
    const mergedConfig = { ...registration.defaultConfig, ...config };
    return new registration.ProviderClass(mergedConfig);
  }

  getRegisteredTypes(): AIProviderType[] {
    return Array.from(this.registry.keys()) as AIProviderType[];
  }

  getDefaultConfig(type: AIProviderType): AIProviderConfig | undefined {
    return this.registry.get(type)?.defaultConfig;
  }
}

export const providerRegistry = new ProviderRegistry();
