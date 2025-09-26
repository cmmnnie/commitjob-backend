import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const prompt = `{"hello": "world"}`;
const r = await client.chat.completions.create({
  model: "gpt-4o-mini",
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: "Return only a valid JSON object." },
    { role: "user", content: prompt }
  ]
});
console.log("OK:", r.choices[0].message.content);
