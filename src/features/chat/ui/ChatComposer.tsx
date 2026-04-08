"use client";

import { useState, useCallback, useRef, type KeyboardEvent, type ClipboardEvent } from "react";
import { Send, X, ImageIcon } from "lucide-react";
import { gaChatMessage } from "@/shared/lib/gtag";
import { toast } from "sonner";
import Image from "next/image";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_DIMENSION = 1200;

function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if exceeds max dimension
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context 생성 실패"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Try quality levels until under 2MB
      const tryQuality = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("이미지 변환 실패"));
              return;
            }
            if (blob.size > MAX_IMAGE_SIZE && quality > 0.3) {
              tryQuality(quality - 0.1);
              return;
            }
            const compressed = new File([blob], file.name, {
              type: "image/jpeg",
            });
            resolve(compressed);
          },
          "image/jpeg",
          quality
        );
      };

      tryQuality(0.8);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽을 수 없습니다"));
    };
    img.src = url;
  });
}

interface ChatComposerProps {
  onSend: (text: string, image?: File | null) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatComposer({ onSend, disabled, placeholder = "메시지를 입력하세요..." }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const clearImage = useCallback(() => {
    setPastedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  }, [imagePreview]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if ((!trimmed && !pastedImage) || sending || disabled) return;

    setSending(true);
    try {
      await onSend(trimmed, pastedImage);
      gaChatMessage();
      setText("");
      clearImage();
      if (textareaRef.current) {
        textareaRef.current.style.height = "36px";
      }
    } catch {
      // Error handled by parent
    } finally {
      setSending(false);
    }
  }, [text, pastedImage, sending, disabled, onSend, clearImage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) {
          toast.error("이미지를 읽을 수 없습니다");
          return;
        }

        try {
          const finalFile =
            file.size > MAX_IMAGE_SIZE ? await compressImage(file) : file;
          setPastedImage(finalFile);
          setImagePreview(URL.createObjectURL(finalFile));
        } catch {
          toast.error("이미지 처리에 실패했습니다");
        }
        return;
      }
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
      {/* Image preview */}
      {imagePreview && (
        <div className="mb-2 relative inline-block">
          <div className="relative w-20 h-20 rounded-md overflow-hidden border border-primary/30 bg-black/40">
            <Image
              src={imagePreview}
              alt="붙여넣은 이미지"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <button
            onClick={clearImage}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#FF6B35] flex items-center justify-center hover:bg-[#FF6B35]/80 transition-colors"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <span className="font-mono text-primary text-sm pb-2 flex-shrink-0 select-none">&gt;</span>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onInput={handleInput}
          disabled={disabled || sending}
          placeholder={pastedImage ? "이미지에 메시지를 추가하세요 (선택)" : placeholder}
          rows={1}
          maxLength={500}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 bg-transparent border-none outline-none resize-none font-mono text-base sm:text-[13px] text-foreground placeholder:text-muted-foreground/40 py-2 min-h-[36px] max-h-[100px] leading-tight"
        />
        {pastedImage && (
          <ImageIcon className="w-4 h-4 text-primary/50 flex-shrink-0 mb-2.5" />
        )}
        <button
          onClick={handleSend}
          disabled={(!text.trim() && !pastedImage) || sending || disabled}
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
