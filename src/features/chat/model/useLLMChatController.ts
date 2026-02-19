import { useEffect, useRef, useState } from "react";
import type { ChatCompletionMessageParam, WebWorkerMLCEngine } from "@mlc-ai/web-llm";
import { createWorkerEngine } from "../../../lib/web-llm";
import type { ChatEngineStatus } from "./types";

export const useLLMChatController = () => {
  const [messages, setMessages] = useState<ChatCompletionMessageParam[]>([
    { role: "system", content: "You are a helpful AI assistant." },
  ]);
  const [engineStatus, setEngineStatus] = useState<ChatEngineStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const engine = useRef<WebWorkerMLCEngine>(null);
  const messagesRef = useRef<ChatCompletionMessageParam[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    let disposed = false;

    const startLLM = async () => {
      setEngineStatus("loading");
      setErrorMessage(null);

      try {
        const nextEngine = await createWorkerEngine();
        if (disposed) return;

        engine.current = nextEngine;
        setEngineStatus("ready");
      } catch {
        if (disposed) return;

        setEngineStatus("error");
        setErrorMessage("Failed to initialize LLM engine.");
      }
    };

    startLLM();

    return () => {
      disposed = true;
    };
  }, []);

  const onMessageSend = async (rawInput: string) => {
    const userInput = rawInput.trim();
    if (!userInput) return;
    if (engineStatus !== "ready" || !engine.current) return;

    setLoading(true);

    const userMessage: ChatCompletionMessageParam = {
      role: "user",
      content: userInput,
    };

    const nextMessages = [...messagesRef.current, userMessage];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);

    try {
      const reply = await engine.current.chat.completions.create({
        messages: nextMessages,
      });

      const assistantMessage = reply.choices?.[0]?.message;
      if (!assistantMessage) return;

      const updatedMessages = [...messagesRef.current, assistantMessage];
      messagesRef.current = updatedMessages;
      setMessages(updatedMessages);
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setLoading(false);
    }
  };

  return { engineStatus, errorMessage, loading, messages, onMessageSend };
};
