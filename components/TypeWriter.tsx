"use client";

import { useState, useEffect } from "react";

interface TypeWriterProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export function TypeWriter({
  text,
  speed = 50,
  className = "",
  onComplete,
}: TypeWriterProps) {
  const [displayed, setDisplayed] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timer = setTimeout(() => {
        setDisplayed((prev) => prev + text[index]);
        setIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timer);
    } else {
      onComplete?.();
    }
  }, [index, text, speed, onComplete]);

  return (
    <span className={className}>
      {displayed}
      {index < text.length && (
        <span className="animate-pulse text-terminal">▊</span>
      )}
    </span>
  );
}
