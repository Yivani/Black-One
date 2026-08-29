export interface ExplicitMemory {
  category:
    | "personal"
    | "work"
    | "hobbies"
    | "projects"
    | "preferences"
    | "writing_style"
    | "goals"
    | "relationships"
    | "other";
  content: string;
  importance: 5;
}

const MAX_EXTRACTION_TEXT_LENGTH = 6000;

export function parseMemoryExtraction(text: string): unknown[] | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const candidates = [cleaned, cleaned.slice(cleaned.indexOf("["), cleaned.lastIndexOf("]") + 1)];
  for (const candidate of candidates) {
    if (!candidate.startsWith("[") || !candidate.endsWith("]")) continue;
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Try the extracted array next.
    }
  }
  return null;
}

export function extractExplicitMemory(userMessage: string): ExplicitMemory | null {
  const match = /^(?:(?:please|can you|could you|would you)\s+)*(?:remember|save)(?:\s+this)?(?:\s+information)?(?:\s+about\s+me)?(?:\s+that)?[\s:,-]+([\s\S]+)$/i.exec(
    userMessage.trim(),
  );
  const content = match?.[1]?.trim();
  if (!content) return null;

  const category = /\b(?:prefer|preference|like|dislike|favorite|favourite)\b/i.test(content)
    ? "preferences"
    : /\b(?:goal|aim|want to|plan to|hope to)\b/i.test(content)
      ? "goals"
      : /\b(?:project|building|working on)\b/i.test(content)
        ? "projects"
        : /\b(?:work|job|role|employer|profession)\b/i.test(content)
          ? "work"
          : /\b(?:hobby|hobbies|enjoy|pastime)\b/i.test(content)
            ? "hobbies"
            : /\b(?:wife|husband|partner|friend|colleague|team)\b/i.test(content)
              ? "relationships"
              : /\b(?:writing style|tone|formatting)\b/i.test(content)
                ? "writing_style"
                : /\babout me\b/i.test(userMessage) || /\b(?:my|i(?:'m| am)|im)\b/i.test(content)
                  ? "personal"
                  : "other";

  return {
    category,
    content,
    importance: 5,
  };
}

export function buildMemoryExtractionPrompt(
  categories: string[],
  userMessage: string,
  assistantResponse: string,
): string {
  const categoryList = categories
    .map((c) => `- ${c.toLowerCase().replace(/\s+/g, "_")}`)
    .join("\n");

  const clippedUserMessage = userMessage.slice(-MAX_EXTRACTION_TEXT_LENGTH);
  const clippedAssistantResponse = assistantResponse.slice(-MAX_EXTRACTION_TEXT_LENGTH);

  return `You are a memory extraction assistant. Your job is to identify durable, useful facts about the user from the conversation turn below and return them as a JSON array.

Rules:
- Return ONLY a JSON array. Do not wrap it in markdown fences, do not add prose, do not add explanations.
- Each object must have exactly these fields:
  - "category": one of the allowed categories listed below (use "other" if unsure)
  - "content": a concise, factual statement in the third person
  - "importance": an integer from 1 (trivial) to 5 (critical). Use 3 for normal facts.
- Prefer importance 3 for typical facts. Use 4-5 only for names, core preferences, recurring tools/frameworks, or major goals.
- Only record genuinely useful, durable facts such as name, preferences, work, hobbies, writing style, recurring tools/frameworks, or goals. Do NOT record transient chat details, greetings, or one-off questions.
- If there are no durable facts to record, return an empty array: []
- Unknown categories must be mapped to "other".

Allowed categories:
${categoryList}

Examples:
[
  { "category": "personal", "content": "User's name is Alex", "importance": 5 },
  { "category": "preferences", "content": "User prefers concise bullet-point answers", "importance": 3 },
  { "category": "work", "content": "User works as a TypeScript engineer", "importance": 4 }
]

Now extract memories from this turn:

User message:
${clippedUserMessage}

Assistant response:
${clippedAssistantResponse}

Remember: return ONLY the JSON array.`;
}
