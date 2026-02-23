"use client";

import { useState, useCallback, useRef, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { gaChatMessage } from "@/lib/gtag";

interface ChatComposerProps {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatComposer({ onSend, disabled, placeholder = "메시지를 입력하세요..." }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    try {
      await onSend(trimmed);
      gaChatMessage();
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "36px";
      }
    } catch {
      // Error handled by parent
    } finally {
      setSending(false);
    }
  }, [text, sending, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "36px";
      el.style.height = Math.min(el.scrollHeight, 100) + "px";
    }
  };

  return (
    <div className="border-t border-border/30 bg-[#0A0E1A]/80 px-3 py-2">
      <div className="flex items-end gap-2">
        <span className="font-mono text-primary text-sm pb-2 flex-shrink-0 select-none">&gt;</span>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled || sending}
          placeholder={placeholder}
          rows={1}
          maxLength={500}
          className="flex-1 bg-transparent border-none outline-none resize-none font-mono text-[13px] text-foreground placeholder:text-muted-foreground/40 py-2 min-h-[36px] max-h-[100px] leading-tight"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending || disabled}
          className="flex-shrink-0 p-1.5 rounded-md text-primary hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors mb-0.5"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      {text.length > 400 && (
        <div className="text-right pr-1">
          <span className={`font-mono text-[10px] ${text.length > 480 ? "text-[#FF6B35]" : "text-muted-foreground/50"}`}>
            {text.length}/500
          </span>
        </div>
      )}
    </div>
  );
}
