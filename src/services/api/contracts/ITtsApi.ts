export interface ITtsApi {
  health(): Promise<unknown>;

  voices(): Promise<unknown>;

  synthesize(data: {
    text: string;
    voice?: string;
    speed?: number;
    output_format?: string;
  }): Promise<Blob>;
}
