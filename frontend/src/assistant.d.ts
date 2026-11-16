declare module "@assistant" {
  export function answerQuestion(question: string, grounding: unknown, provider: unknown): { answer: string; topic: string; grounded: boolean; data_as_of: string | null; data_mode: string };
}
