"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { TypeWriter } from "@/components/TypeWriter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [titleDone, setTitleDone] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      if (user.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/vote");
      }
    }
  }, [user, loading, router]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!code.trim()) return;

      setIsLoading(true);
      setError("");

      try {
        await login(code.trim().toUpperCase());
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "인증에 실패했습니다");
      } finally {
        setIsLoading(false);
      }
    },
    [code, login]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0E1A]">
        <span className="font-mono text-[#00FF88] animate-pulse">로딩 중...</span>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#0A0E1A] px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="text-center space-y-3">
          <p className="font-mono text-sm text-[#4DAFFF] tracking-widest uppercase">
            GDG Busan
          </p>
          <h1 className="font-mono text-3xl sm:text-4xl font-bold glow-green text-[#00FF88] leading-tight min-h-[2.5rem]">
            <TypeWriter
              text="Build with AI"
              speed={80}
              onComplete={() => setTitleDone(true)}
            />
          </h1>
          <p className="font-mono text-sm text-[#00FF88]/70">
            {titleDone ? (
              <TypeWriter
                text="> 투표 시스템에 접속합니다..."
                speed={40}
              />
            ) : (
              <span className="invisible">&nbsp;</span>
            )}
          </p>
        </div>

        {/* Login card */}
        <div className="border border-[#00FF88]/20 bg-[#1A2235]/60 backdrop-blur rounded-lg p-8 space-y-6">
          <div className="space-y-1">
            <p className="font-mono text-xs text-[#4DAFFF] tracking-wider">
              {"// 참가자 코드 입력"}
            </p>
            <p className="font-mono text-xs text-[#00FF88]/50">
              배정받은 고유 코드를 입력하세요
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError("");
              }}
              placeholder="GDG-XXXX"
              className="font-mono tracking-widest text-center text-[#00FF88] bg-[#0A0E1A] border-[#00FF88]/30 placeholder:text-[#00FF88]/20 focus:border-[#00FF88] focus:ring-[#00FF88]/20 uppercase"
              maxLength={12}
              autoComplete="off"
              spellCheck={false}
              disabled={isLoading}
            />

            {error && (
              <p className="font-mono text-xs text-[#FF6B35] text-center">
                {">"} {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading || !code.trim()}
              className="w-full font-mono bg-[#00FF88] text-[#0A0E1A] hover:bg-[#00FF88]/90 disabled:opacity-40 font-bold tracking-wider"
            >
              {isLoading ? (
                <span className="animate-pulse">접속 중...</span>
              ) : (
                "접속하기"
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center font-mono text-xs text-[#4DAFFF]/30">
          GDG Busan Hackathon 2026
        </p>
      </div>
    </main>
  );
}
