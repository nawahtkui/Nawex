import { ProviderAdapter } from "./providerAdapter.js";

export class TavilyProvider extends ProviderAdapter {
  constructor() {
    super("tavily");

    this.apiKey = process.env.TAVILY_API_KEY;

    if (!this.apiKey) {
      throw new Error("TAVILY_API_KEY is not configured");
    }
  }

  async search(query, options = {}) {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        search_depth: options.searchDepth || "advanced",
        max_results: options.maxResults || 10,
        include_answer: options.includeAnswer ?? false,
        include_raw_content: options.includeRawContent ?? false
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Tavily search failed: ${response.status} ${body}`
      );
    }

    const data = await response.json();

    return {
      provider: "tavily",
      query,
      results: data.results || [],
      answer: data.answer || null
    };
  }
}
