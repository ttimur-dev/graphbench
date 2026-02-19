export type LlmMessageRole = "system" | "user" | "assistant";

export type LlmMessageType = {
  content: string;
  role: LlmMessageRole;
};
