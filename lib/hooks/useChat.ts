'use client';

import { useState, useCallback, FormEvent } from 'react';
import { supabase } from '@/lib/supabase/client';

interface UseChatOptions {
  api: string;
  onFinish?: (message: { content: string; toolInvocations?: Array<{ toolName: string; result?: any }> }) => Promise<void>;
}

interface UseChatHelpers {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e?: FormEvent) => void;
  isLoading: boolean;
  setMessages: (messages: Array<{ role: string; content: string }>) => void;
}

export function useChat({ api, onFinish }: UseChatOptions): UseChatHelpers {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const handleSubmit = useCallback(async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage = trimmedInput;
    setInput('');
    setIsLoading(true);

    // Optimistically add user message
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Authentication Error: You are not logged in.");
        throw new Error('Not authenticated');
      }

      console.log("Sending request to AI...");
      
      const response = await fetch(api, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        let errorMsg = `Status ${response.status}`;
        try {
          const errJson = await response.json();
          errorMsg = errJson.error || errJson.message || errorMsg;
        } catch {
          errorMsg = await response.text();
        }
        
        console.error("AI Error Details:", errorMsg);
        alert(`AI Error: ${errorMsg}`); 
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log("AI Response received:", {
        hasContent: !!data.content,
        contentLength: data.content?.length || 0,
        hasToolInvocations: !!data.toolInvocations,
        toolInvocationsCount: data.toolInvocations?.length || 0,
        fullData: data,
      });

      if (data.content) {
        setMessages([...newMessages, { role: 'assistant', content: data.content }]);
      } else if (data.toolInvocations && data.toolInvocations.length > 0) {
        console.log("AI used tools but generated no text. Tool invocations:", data.toolInvocations);
      }

      if (onFinish) {
        console.log("Calling onFinish with:", {
          content: data.content || '',
          toolInvocations: data.toolInvocations,
        });
        await onFinish({
          content: data.content || '',
          toolInvocations: data.toolInvocations,
        });
        console.log("onFinish completed");
      } else {
        console.warn("onFinish callback not provided!");
      }

    } catch (error) {
      console.error('Chat execution failed:', error);
      // Optional: setMessages(messages) to revert if needed
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, api, onFinish, isLoading]);

  return {
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
  };
}