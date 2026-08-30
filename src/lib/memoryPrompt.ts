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
