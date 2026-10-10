import { GoogleGenAI } from "@google/genai";
import { ProviderAdapter } from "./providerAdapter.js";

export class GeminiProvider extends ProviderAdapter {
  constructor({
    model = "gemini-3.8-flash"
  } = {}) {
    super("gemini");

    this.model = model;

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    this.client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });
  }

  async search(query, options = {}) {
    const prompt =
      typeof query === "string"
        ? query
        : query.query ||
          query.title ||
          JSON.stringify(query);

    const response =
      await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          temperature:
            options.temperature ?? 0.2
        }
      });

    return {
      provider: this.name,
      model: this.model,
      query: prompt,
      text: response.text || null
    };
  }
}
