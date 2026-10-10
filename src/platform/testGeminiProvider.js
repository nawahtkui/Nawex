import "dotenv/config";

import { GeminiProvider } from "../providers/geminiProvider.js";

const provider = new GeminiProvider();

const result = await provider.search(
  "Reply with exactly: GEMINI_OK"
);

console.log(
  JSON.stringify(
    {
      status: "PASS",
      provider: result.provider,
      model: result.model,
      text: result.text
    },
    null,
    2
  )
);
