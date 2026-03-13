"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

const INPUT_CLASS =
  "font-mono text-sm text-[#00FF88] bg-[#0A0E1A] border-[#00FF88]/30 placeholder:text-[#00FF88]/20 focus:border-[#00FF88] focus:ring-[#00FF88]/20";

export default function LookupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ code: string; name: string } | null>(null);

  const handleInput = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setError("");
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "조회에 실패했습니다");
        return;
      }

      setResult(data);
    } catch {
      setError("서버 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#0A0E1A] px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="text-center space-y-3">
          <p className="font-mono text-sm text-[#4DAFFF] tracking-widest uppercase">
            GDG Busan
          </p>
          <h1 className="font-mono text-2xl sm:text-3xl font-bold text-[#00FF88]">
            참가코드 조회
          </h1>
          <p className="font-mono text-xs text-[#00FF88]/50">
            예매 시 사용한 이름과 이메일로 참가코드를 확인하세요
          </p>
        </div>

        {/* Lookup card */}
        <div className="border border-[#00FF88]/20 bg-[#1A2235]/60 backdrop-blur rounded-lg p-8 space-y-6">
          <div className="space-y-1">
            <p className="font-mono text-xs text-[#4DAFFF] tracking-wider">
              {"// 이름 + 이메일 입력"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              value={name}
              onChange={handleInput(setName)}
              placeholder="홍길동"
              className={INPUT_CLASS}
              autoComplete="name"
              disabled={isLoading}
            />
            <Input
              type="email"
              value={email}
              onChange={handleInput(setEmail)}
              placeholder="example@gmail.com"
              className={INPUT_CLASS}
              autoComplete="email"
              disabled={isLoading}
            />

            {error && (
              <p className="font-mono text-xs text-[#FF6B35] text-center">
                {">"} {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading || !name.trim() || !email.trim()}
              className="w-full font-mono bg-[#00FF88] text-[#0A0E1A] hover:bg-[#00FF88]/90 disabled:opacity-40 font-bold tracking-wider"
            >
              {isLoading ? (
                <span className="animate-pulse">조회 중...</span>
              ) : (
                "코드 조회"
              )}
            </Button>
          </form>

          {/* Result */}
          {result && (
            <div className="border border-[#00FF88]/40 bg-[#00FF88]/5 rounded-lg p-6 space-y-4">
              <p className="font-mono text-xs text-[#4DAFFF]">
                {"// 조회 결과"}
              </p>
              <div className="text-center space-y-2">
                <p className="font-mono text-sm text-[#00FF88]/70">
                  {result.name}님의 참가코드
                </p>
                <p className="font-mono text-3xl font-bold text-[#00FF88] tracking-widest select-all">
                  {result.code}
                </p>
                <p className="font-mono text-xs text-[#00FF88]/40 mt-2">
                  이 코드를 복사하여 로그인에 사용하세요
                </p>
              </div>
              <Link href="/">
                <Button
                  className="w-full font-mono bg-[#4DAFFF] text-[#0A0E1A] hover:bg-[#4DAFFF]/90 font-bold tracking-wider mt-2"
                >
                  로그인하러 가기
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center space-y-2">
          <Link
            href="/"
            className="font-mono text-xs text-[#4DAFFF]/50 hover:text-[#4DAFFF] transition-colors"
          >
            ← 로그인 페이지로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
