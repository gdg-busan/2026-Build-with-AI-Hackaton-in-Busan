"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TeamScore } from "@/lib/types";

interface ResultRevealProps {
  scores: TeamScore[];
  onComplete: () => void;
}

type Stage = "blackout" | "glitch" | "reveal-mid" | "top3" | "final";

const MATRIX_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()アイウエオカキクケコ";

function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const fontSize = 16;
    const cols = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array(cols).fill(1);

    const draw = () => {
      ctx.fillStyle = "rgba(10, 14, 26, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00FF88";
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 33);
    return () => clearInterval(interval);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

function getRankStyle(rank: number) {
  if (rank === 1) return "rank-gold";
  if (rank === 2) return "rank-silver";
  if (rank === 3) return "rank-bronze";
  return "text-[#E8F4FD]";
}

function getRankLabel(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export function ResultReveal({ scores, onComplete }: ResultRevealProps) {
  const [stage, setStage] = useState<Stage>("blackout");
  const [countdown, setCountdown] = useState(5);
  const [revealedMid, setRevealedMid] = useState<TeamScore[]>([]);
  const [revealedTop3, setRevealedTop3] = useState<TeamScore[]>([]);
  const confettiRef = useRef(false);

  const top10 = scores.slice(0, 10);
  const midPlaces = top10.filter((s) => s.rank >= 4 && s.rank <= 10).reverse(); // reveal 10th first
  const top3 = top10.filter((s) => s.rank <= 3).sort((a, b) => b.rank - a.rank); // 3,2,1

  const fireConfetti = useCallback(async () => {
    if (confettiRef.current) return;
    confettiRef.current = true;
    const confetti = (await import("canvas-confetti")).default;
    const duration = 4000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#FFD700", "#00FF88", "#4DAFFF", "#FF6B35"] });
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#FFD700", "#00FF88", "#4DAFFF", "#FF6B35"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  // Stage 1: Blackout countdown 5->0
  useEffect(() => {
    if (stage !== "blackout") return;
    if (countdown <= 0) {
      setTimeout(() => setStage("glitch"), 300);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, countdown]);

  // Stage 2: Glitch for 3s then reveal mid
  useEffect(() => {
    if (stage !== "glitch") return;
    const t = setTimeout(() => setStage("reveal-mid"), 3000);
    return () => clearTimeout(t);
  }, [stage]);

  // Stage 3: Reveal 10th to 4th one by one
  useEffect(() => {
    if (stage !== "reveal-mid") return;
    if (revealedMid.length < midPlaces.length) {
      const t = setTimeout(() => {
        setRevealedMid((prev) => [...prev, midPlaces[prev.length]]);
      }, 1500);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setStage("top3"), 2000);
      return () => clearTimeout(t);
    }
  }, [stage, revealedMid, midPlaces]);

  // Stage 4: Reveal top 3 one by one (3rd, 2nd, 1st)
  useEffect(() => {
    if (stage !== "top3") return;
    if (revealedTop3.length < top3.length) {
      const t = setTimeout(() => {
        const next = top3[revealedTop3.length];
        setRevealedTop3((prev) => [...prev, next]);
        if (next.rank === 1) fireConfetti();
      }, 2000);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setStage("final"), 3000);
      return () => clearTimeout(t);
    }
  }, [stage, revealedTop3, top3, fireConfetti]);

  return (
    <div className={`fixed inset-0 bg-[#0A0E1A] flex justify-center z-50 ${stage === "final" ? "items-start overflow-y-auto" : "items-center overflow-hidden"}`}>
      {/* Stage 1: Blackout */}
      <AnimatePresence>
        {stage === "blackout" && (
          <motion.div
            key="blackout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-8"
          >
            <motion.p
              className="text-[#7B8BA3] text-2xl font-mono tracking-widest uppercase"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              결과 발표 준비 중...
            </motion.p>
            <AnimatePresence mode="wait">
              <motion.div
                key={countdown}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="text-[#00FF88] font-mono font-bold glow-green"
                style={{ fontSize: "12rem", lineHeight: 1 }}
              >
                {countdown === 0 ? "GO!" : countdown}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 2: Glitch + Matrix */}
      <AnimatePresence>
        {stage === "glitch" && (
          <motion.div
            key="glitch"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <MatrixRain />
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.h1
                className="text-[#00FF88] font-mono font-black glow-green glitch text-center"
                style={{ fontSize: "5rem" }}
              >
                RESULT
                <br />
                REVEAL
              </motion.h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 3: Reveal mid places (10th to 4th) */}
      <AnimatePresence>
        {stage === "reveal-mid" && (
          <motion.div
            key="reveal-mid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-3xl px-6 flex flex-col gap-4"
          >
            <motion.h2
              className="text-[#4DAFFF] font-mono text-2xl text-center mb-4 glow-blue"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              TOP 10 ANNOUNCEMENT
            </motion.h2>
            <AnimatePresence>
              {revealedMid.map((team) => (
                <motion.div
                  key={team.teamId}
                  initial={{ x: -120, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="flex items-center gap-4 bg-[#1A2235] rounded-xl px-6 py-4 border border-[rgba(77,175,255,0.15)]"
                >
                  <span className="text-[#7B8BA3] font-mono text-3xl font-bold w-12 text-right">
                    #{team.rank}
                  </span>
                  <span className="text-4xl">{team.emoji}</span>
                  <span className="text-[#E8F4FD] font-bold flex-1" style={{ fontSize: "1.75rem" }}>
                    {team.teamName}{team.teamNickname && <span className="text-[#7B8BA3] text-lg ml-2">({team.teamNickname})</span>}
                  </span>
                  <span className="text-[#00FF88] font-mono font-bold glow-green" style={{ fontSize: "1.5rem" }}>
                    {team.finalScore.toFixed(1)}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 4: TOP 3 Special */}
      <AnimatePresence>
        {stage === "top3" && (
          <motion.div
            key="top3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-2xl px-6 flex flex-col items-center gap-6"
          >
            <motion.h2
              className="font-mono font-black glow-green text-center"
              style={{ fontSize: "3rem", color: "#00FF88" }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              TOP 3
            </motion.h2>
            <AnimatePresence>
              {revealedTop3.map((team) => {
                const rankClass = getRankStyle(team.rank);
                const glowClass =
                  team.rank === 1 ? "shadow-[0_0_60px_rgba(255,215,0,0.4)]" :
                  team.rank === 2 ? "shadow-[0_0_40px_rgba(192,192,192,0.3)]" :
                  "shadow-[0_0_40px_rgba(205,127,50,0.3)]";
                return (
                  <motion.div
                    key={team.teamId}
                    initial={{ scale: 0.5, opacity: 0, y: 40 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className={`w-full bg-[#1A2235] rounded-2xl px-8 py-6 border border-[rgba(77,175,255,0.2)] ${glowClass} flex items-center gap-6`}
                  >
                    <span className={`font-mono font-black ${rankClass}`} style={{ fontSize: "4rem" }}>
                      {getRankLabel(team.rank)}
                    </span>
                    <span style={{ fontSize: "3.5rem" }}>{team.emoji}</span>
                    <div className="flex-1">
                      <p className={`font-bold ${rankClass}`} style={{ fontSize: "2rem" }}>
                        {team.teamName}{team.teamNickname && <span className="text-[#7B8BA3] text-base ml-2">({team.teamNickname})</span>}
                      </p>
                      <p className="text-[#7B8BA3] font-mono text-lg">
                        Score: <span className={rankClass}>{team.finalScore.toFixed(1)}</span>
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 5: Final Scoreboard */}
      <AnimatePresence>
        {stage === "final" && (
          <motion.div
            key="final"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-4xl px-6 py-10 flex flex-col gap-4"
          >
            <motion.h2
              className="text-[#00FF88] font-mono font-black glow-green text-center mb-2"
              style={{ fontSize: "2.5rem" }}
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              FINAL SCOREBOARD
            </motion.h2>
            {scores.map((team, i) => {
              const rankClass = getRankStyle(team.rank);
              const maxScore = scores[0]?.finalScore || 100;
              const pct = (team.finalScore / maxScore) * 100;
              return (
                <motion.div
                  key={team.teamId}
                  initial={{ x: -80, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.08, type: "spring", stiffness: 200 }}
                  className="bg-[#1A2235] rounded-xl px-5 py-3 border border-[rgba(77,175,255,0.15)]"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`font-mono font-bold w-10 text-right ${rankClass}`} style={{ fontSize: "1.4rem" }}>
                      {getRankLabel(team.rank)}
                    </span>
                    <span style={{ fontSize: "1.6rem" }}>{team.emoji}</span>
                    <span className={`font-bold flex-1 ${rankClass}`} style={{ fontSize: "1.3rem" }}>
                      {team.teamName}{team.teamNickname && <span className="text-[#7B8BA3] text-sm ml-2">({team.teamNickname})</span>}
                    </span>
                    <span className={`font-mono font-bold ${rankClass}`} style={{ fontSize: "1.3rem" }}>
                      {team.finalScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="ml-[5.5rem] bg-[#0A0E1A] rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full progress-glow"
                      style={{
                        background: team.rank === 1 ? "#FFD700" : team.rank === 2 ? "#C0C0C0" : team.rank === 3 ? "#CD7F32" : "#00FF88"
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.08 + 0.3, duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </motion.div>
              );
            })}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              onClick={onComplete}
              className="mt-4 mx-auto px-8 py-3 border border-[#00FF88] text-[#00FF88] font-mono rounded-xl hover:bg-[#00FF88] hover:text-[#0A0E1A] transition-colors"
              style={{ fontSize: "1.1rem" }}
            >
              완료
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
