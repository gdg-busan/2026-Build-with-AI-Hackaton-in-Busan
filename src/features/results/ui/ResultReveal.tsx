"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Team, TeamScore } from "@/shared/types";

interface ResultRevealProps {
  phase: "p1" | "final";
  p1Teams?: Team[];
  scores?: TeamScore[];
  onComplete: () => void;
}

type StageP1 = "blackout" | "glitch" | "reveal-all" | "final";
type StageFinal = "blackout" | "glitch" | "drumroll" | "top3" | "final";

const MATRIX_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()";

/* ─── Phase 1: Blue Matrix Rain ─── */
function BlueMatrixRain() {
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
      ctx.fillStyle = "#4DAFFF";
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

/* ─── Final: Golden Particle Burst ─── */
function GoldenParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: { x: number; y: number; vx: number; vy: number; size: number; color: string; alpha: number; life: number }[] = [];
    const colors = ["#FFD700", "#FFA500", "#FF6B35", "#FFED4A", "#F5C542"];

    const spawn = () => {
      for (let i = 0; i < 3; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2 - 0.5,
          size: Math.random() * 4 + 1,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          life: Math.random() * 120 + 60,
        });
      }
    };

    let frame = 0;
    const draw = () => {
      ctx.fillStyle = "rgba(10, 14, 26, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (frame % 2 === 0) spawn();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.alpha = Math.max(0, p.life / 120);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;

        // glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        grad.addColorStop(0, p.color + Math.round(p.alpha * 40).toString(16).padStart(2, "0"));
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fill();

        if (p.life <= 0) particles.splice(i, 1);
      }
      frame++;
    };

    const interval = setInterval(draw, 33);
    return () => clearInterval(interval);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

/* ─── Drumroll Pulse (between final reveals) ─── */
function DrumrollPulse() {
  return (
    <div className="flex items-center justify-center gap-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="w-2 rounded-full bg-[#FFD700]"
          animate={{
            height: [8, 32, 8],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            repeat: Infinity,
            duration: 0.6,
            delay: i * 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Screen Flash Overlay ─── */
function ScreenFlash({ color = "#FFD700" }: { color?: string }) {
  return (
    <motion.div
      className="fixed inset-0 z-[60] pointer-events-none"
      style={{ backgroundColor: color }}
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    />
  );
}

function getRankStyle(rank: number) {
  if (rank === 1) return "rank-gold";
  if (rank === 2) return "rank-silver";
  if (rank === 3) return "rank-bronze";
  return "text-[#E8F4FD]";
}

function getRankLabel(rank: number) {
  if (rank === 1) return "\u{1F947}";
  if (rank === 2) return "\u{1F948}";
  if (rank === 3) return "\u{1F949}";
  return `#${rank}`;
}

/* ═══════════════════════════════════════════════════
   Phase 1 Reveal — TOP 10
   Blue theme, fast-paced, energetic
   ═══════════════════════════════════════════════════ */
function Phase1Reveal({ teams, onComplete }: { teams: Team[]; onComplete: () => void }) {
  const [stage, setStage] = useState<StageP1>("blackout");
  const [countdown, setCountdown] = useState(5);
  const [revealedTeams, setRevealedTeams] = useState<Team[]>([]);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stage === "reveal-all" && scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [stage, revealedTeams.length]);

  // Blackout countdown
  useEffect(() => {
    if (stage !== "blackout") return;
    if (countdown <= 0) {
      setTimeout(() => setStage("glitch"), 300);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, countdown]);

  // Glitch 2.5s then reveal
  useEffect(() => {
    if (stage !== "glitch") return;
    const t = setTimeout(() => setStage("reveal-all"), 2500);
    return () => clearTimeout(t);
  }, [stage]);

  // Fast sequential reveal (200ms each)
  useEffect(() => {
    if (stage !== "reveal-all") return;
    if (revealedTeams.length < teams.length) {
      const t = setTimeout(() => {
        setRevealedTeams((prev) => [...prev, teams[prev.length]]);
      }, 200);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setStage("final"), 2000);
      return () => clearTimeout(t);
    }
  }, [stage, revealedTeams, teams]);

  return (
    <div className={`fixed inset-0 bg-[#0A0E1A] flex justify-center z-50 ${stage === "reveal-all" || stage === "final" ? "items-start overflow-y-auto pt-8" : "items-center overflow-hidden"}`}>
      {/* Blackout */}
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
              TOP 10 발표 준비 중...
            </motion.p>
            <AnimatePresence mode="wait">
              <motion.div
                key={countdown}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="text-[#4DAFFF] font-mono font-bold glow-blue"
                style={{ fontSize: "12rem", lineHeight: 1 }}
              >
                {countdown === 0 ? "GO!" : countdown}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glitch — Blue Matrix */}
      <AnimatePresence>
        {stage === "glitch" && (
          <motion.div
            key="glitch"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <BlueMatrixRain />
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.h1
                className="text-[#4DAFFF] font-mono font-black glow-blue glitch text-center"
                style={{ fontSize: "5rem" }}
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              >
                TOP 10
                <br />
                SELECTED!
              </motion.h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sequential reveal */}
      <AnimatePresence>
        {stage === "reveal-all" && (
          <motion.div
            key="reveal-all"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-3xl px-6 flex flex-col gap-3"
          >
            <motion.h2
              className="text-[#4DAFFF] font-mono text-2xl text-center mb-4 glow-blue"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              TOP 10 SELECTED!
            </motion.h2>
            <AnimatePresence>
              {revealedTeams.map((team) => (
                <motion.div
                  key={team.id}
                  initial={{ x: -120, opacity: 0, scale: 0.95 }}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="flex items-center gap-4 bg-[#1A2235] rounded-xl px-6 py-4 border border-[rgba(77,175,255,0.3)] shadow-[0_0_20px_rgba(77,175,255,0.15)]"
                >
                  <span className="text-4xl">{team.emoji}</span>
                  <span className="text-[#4DAFFF] font-bold flex-1 glow-blue" style={{ fontSize: "1.5rem" }}>
                    {team.name}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={scrollEndRef} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Final grid */}
      <AnimatePresence>
        {stage === "final" && (
          <motion.div
            key="final"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-4xl px-6 py-10 flex flex-col gap-4"
          >
            <motion.h2
              className="text-[#4DAFFF] font-mono font-black glow-blue text-center mb-6"
              style={{ fontSize: "2.5rem" }}
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              TOP 10 TEAMS
            </motion.h2>
            <div className="grid grid-cols-2 gap-4">
              {teams.map((team, i) => (
                <motion.div
                  key={team.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.06, type: "spring", stiffness: 200 }}
                  className="bg-[#1A2235] rounded-xl px-5 py-4 border border-[rgba(77,175,255,0.25)] flex items-center gap-3"
                >
                  <span className="text-3xl">{team.emoji}</span>
                  <span className="text-[#4DAFFF] font-bold glow-blue" style={{ fontSize: "1.1rem" }}>
                    {team.name}
                  </span>
                </motion.div>
              ))}
            </div>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              onClick={onComplete}
              className="mt-6 mx-auto px-8 py-3 border border-[#4DAFFF] text-[#4DAFFF] font-mono rounded-xl hover:bg-[#4DAFFF] hover:text-[#0A0E1A] transition-colors"
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

/* ═══════════════════════════════════════════════════
   Final Reveal — TOP 3
   Gold theme, slow & dramatic, per-rank unique effects
   ═══════════════════════════════════════════════════ */

// Per-rank entrance animations
const rankAnimations = {
  3: { initial: { x: 300, opacity: 0, scale: 0.8 }, animate: { x: 0, opacity: 1, scale: 1 }, transition: { type: "spring" as const, stiffness: 180, damping: 18 } },
  2: { initial: { x: -300, opacity: 0, scale: 0.6 }, animate: { x: 0, opacity: 1, scale: 1 }, transition: { type: "spring" as const, stiffness: 160, damping: 15 } },
  1: { initial: { scale: 0, opacity: 0, rotate: -10 }, animate: { scale: 1, opacity: 1, rotate: 0 }, transition: { type: "spring" as const, stiffness: 200, damping: 12, duration: 0.8 } },
};

const rankGlowStyles = {
  1: "shadow-[0_0_80px_rgba(255,215,0,0.5),0_0_160px_rgba(255,215,0,0.2)] border-[rgba(255,215,0,0.5)]",
  2: "shadow-[0_0_50px_rgba(192,192,192,0.4),0_0_100px_rgba(192,192,192,0.15)] border-[rgba(192,192,192,0.4)]",
  3: "shadow-[0_0_40px_rgba(205,127,50,0.35),0_0_80px_rgba(205,127,50,0.1)] border-[rgba(205,127,50,0.35)]",
};

const rankBorderPulse = {
  1: { boxShadow: ["0 0 40px rgba(255,215,0,0.3)", "0 0 100px rgba(255,215,0,0.6)", "0 0 40px rgba(255,215,0,0.3)"] },
  2: { boxShadow: ["0 0 30px rgba(192,192,192,0.2)", "0 0 60px rgba(192,192,192,0.4)", "0 0 30px rgba(192,192,192,0.2)"] },
  3: { boxShadow: ["0 0 20px rgba(205,127,50,0.2)", "0 0 40px rgba(205,127,50,0.3)", "0 0 20px rgba(205,127,50,0.2)"] },
};

function FinalReveal({ scores, onComplete }: { scores: TeamScore[]; onComplete: () => void }) {
  const [stage, setStage] = useState<StageFinal>("blackout");
  const [countdown, setCountdown] = useState(5);
  const [revealedTop3, setRevealedTop3] = useState<TeamScore[]>([]);
  const [showFlash, setShowFlash] = useState(false);
  const waitingNextRef = useRef(false);
  const confettiRef = useRef(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  const top3 = useMemo(() => [...scores].sort((a, b) => b.rank - a.rank), [scores]); // 3,2,1 order

  useEffect(() => {
    if (stage === "top3" && scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [stage, revealedTop3.length]);

  const fireConfetti = useCallback(async (intensity: "small" | "medium" | "large") => {
    const confetti = (await import("canvas-confetti")).default;
    const colors = ["#FFD700", "#00FF88", "#4DAFFF", "#FF6B35"];

    if (intensity === "small") {
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.7 }, colors });
    } else if (intensity === "medium") {
      confetti({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.6 }, colors });
      confetti({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, colors });
    } else {
      // Grand finale confetti
      if (confettiRef.current) return;
      confettiRef.current = true;
      const duration = 5000;
      const end = Date.now() + duration;
      const frame = () => {
        confetti({ particleCount: 8, angle: 60, spread: 55, origin: { x: 0 }, colors });
        confetti({ particleCount: 8, angle: 120, spread: 55, origin: { x: 1 }, colors });
        confetti({ particleCount: 4, angle: 90, spread: 120, origin: { y: 0 }, colors, gravity: 0.6 });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, []);

  // Blackout countdown with dramatic pulsing background
  useEffect(() => {
    if (stage !== "blackout") return;
    if (countdown <= 0) {
      setTimeout(() => setStage("glitch"), 300);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, countdown]);

  // Glitch: Golden particles for 3.5s then drumroll
  useEffect(() => {
    if (stage !== "glitch") return;
    const t = setTimeout(() => setStage("drumroll"), 3500);
    return () => clearTimeout(t);
  }, [stage]);

  // Drumroll: 2s of suspense before top3
  useEffect(() => {
    if (stage !== "drumroll") return;
    const t = setTimeout(() => setStage("top3"), 2000);
    return () => clearTimeout(t);
  }, [stage]);

  // Top 3 reveal: slower, per-rank effects
  useEffect(() => {
    if (stage !== "top3") return;
    if (waitingNextRef.current) return;
    if (revealedTop3.length < top3.length) {
      waitingNextRef.current = true;
      const delay = revealedTop3.length === 0 ? 1500 : 3500; // first one faster
      const t = setTimeout(() => {
        const next = top3[revealedTop3.length];
        setRevealedTop3((prev) => [...prev, next]);
        waitingNextRef.current = false;

        // Per-rank effects
        if (next.rank === 3) fireConfetti("small");
        if (next.rank === 2) fireConfetti("medium");
        if (next.rank === 1) {
          setShowFlash(true);
          setTimeout(() => setShowFlash(false), 800);
          fireConfetti("large");
        }
      }, delay);
      return () => {
        clearTimeout(t);
        waitingNextRef.current = false;
      };
    } else {
      const t = setTimeout(() => setStage("final"), 4000);
      return () => clearTimeout(t);
    }
  }, [stage, revealedTop3, top3, fireConfetti]);

  return (
    <div className={`fixed inset-0 bg-[#0A0E1A] flex justify-center z-50 ${stage === "top3" || stage === "final" ? "items-start overflow-y-auto pt-8" : "items-center overflow-hidden"}`}>
      {/* Screen flash on 1st place */}
      {showFlash && <ScreenFlash color="#FFD700" />}

      {/* Blackout — dramatic pulse */}
      <AnimatePresence>
        {stage === "blackout" && (
          <motion.div
            key="blackout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-8"
          >
            {/* Pulsing ring behind countdown */}
            <motion.div
              className="absolute w-80 h-80 rounded-full border-2 border-[#FFD700]"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 0, 0.3],
              }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            <motion.p
              className="text-[#7B8BA3] text-2xl font-mono tracking-widest uppercase"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              최종 결과 발표 준비 중...
            </motion.p>
            <AnimatePresence mode="wait">
              <motion.div
                key={countdown}
                initial={{ scale: 3, opacity: 0, rotate: -15 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.3, opacity: 0, rotate: 15 }}
                transition={{ duration: 0.4 }}
                className="text-[#FFD700] font-mono font-bold"
                style={{ fontSize: "14rem", lineHeight: 1, textShadow: "0 0 60px rgba(255,215,0,0.6), 0 0 120px rgba(255,215,0,0.3)" }}
              >
                {countdown === 0 ? "GO!" : countdown}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glitch — Golden Particles */}
      <AnimatePresence>
        {stage === "glitch" && (
          <motion.div
            key="glitch"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <GoldenParticles />
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.h1
                className="font-mono font-black text-center"
                style={{
                  fontSize: "6rem",
                  color: "#FFD700",
                  textShadow: "0 0 40px rgba(255,215,0,0.5), 0 0 80px rgba(255,215,0,0.3)",
                }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              >
                FINAL
                <br />
                REVEAL
              </motion.h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drumroll — suspense build-up */}
      <AnimatePresence>
        {stage === "drumroll" && (
          <motion.div
            key="drumroll"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center gap-8"
          >
            <motion.p
              className="text-[#FFD700] font-mono text-3xl font-bold tracking-widest"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              style={{ textShadow: "0 0 20px rgba(255,215,0,0.4)" }}
            >
              ANNOUNCING...
            </motion.p>
            <DrumrollPulse />
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP 3 — per-rank dramatic reveal */}
      <AnimatePresence>
        {stage === "top3" && (
          <motion.div
            key="top3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-2xl px-6 flex flex-col items-center gap-8"
          >
            <motion.h2
              className="font-mono font-black text-center"
              style={{ fontSize: "3rem", color: "#FFD700", textShadow: "0 0 30px rgba(255,215,0,0.4)" }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              TOP 3
            </motion.h2>

            <AnimatePresence>
              {revealedTop3.map((team) => {
                const rank = team.rank as 1 | 2 | 3;
                const anim = rankAnimations[rank];
                const glowStyle = rankGlowStyles[rank];
                const pulseAnim = rankBorderPulse[rank];
                const cardSize = rank === 1 ? "py-8 px-10" : rank === 2 ? "py-7 px-8" : "py-6 px-8";
                const nameSize = rank === 1 ? "2.5rem" : rank === 2 ? "2rem" : "1.8rem";
                const emojiSize = rank === 1 ? "5rem" : rank === 2 ? "4rem" : "3.5rem";
                const rankSize = rank === 1 ? "5rem" : rank === 2 ? "4.5rem" : "4rem";

                return (
                  <motion.div
                    key={team.teamId}
                    initial={anim.initial}
                    animate={{ ...anim.animate, ...pulseAnim }}
                    transition={{
                      ...anim.transition,
                      boxShadow: { repeat: Infinity, duration: 2, ease: "easeInOut" },
                    }}
                    className={`w-full bg-[#1A2235] rounded-2xl ${cardSize} border-2 ${glowStyle} flex items-center gap-6`}
                  >
                    <span className={`font-mono font-black ${getRankStyle(rank)}`} style={{ fontSize: rankSize }}>
                      {getRankLabel(rank)}
                    </span>
                    <span style={{ fontSize: emojiSize }}>{team.emoji}</span>
                    <div className="flex-1">
                      <p className={`font-bold ${getRankStyle(rank)}`} style={{ fontSize: nameSize }}>
                        {team.teamName}{team.teamNickname && <span className="text-[#7B8BA3] text-base ml-2">({team.teamNickname})</span>}
                      </p>
                      <p className="text-[#7B8BA3] font-mono text-lg">
                        Score: <span className={getRankStyle(rank)}>{team.finalScore.toFixed(1)}</span>
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Drumroll between reveals */}
            {revealedTop3.length > 0 && revealedTop3.length < top3.length && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-4"
              >
                <DrumrollPulse />
              </motion.div>
            )}

            <div ref={scrollEndRef} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Final Scoreboard */}
      <AnimatePresence>
        {stage === "final" && (
          <motion.div
            key="final"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-4xl px-6 py-10 flex flex-col gap-4"
          >
            <motion.h2
              className="font-mono font-black text-center mb-2"
              style={{ fontSize: "2.5rem", color: "#FFD700", textShadow: "0 0 30px rgba(255,215,0,0.4)" }}
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              FINAL SCOREBOARD
            </motion.h2>
            {/* Podium */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-3 gap-4 mb-6"
            >
              {[scores[1], scores[0], scores[2]].map((team, idx) => {
                if (!team) return <div key={idx} />;
                const podiumOrder = [2, 1, 3];
                const actualRank = podiumOrder[idx];
                const heights = ["h-28", "h-36", "h-20"];
                const rankClass = getRankStyle(actualRank);
                return (
                  <motion.div
                    key={team.teamId}
                    initial={{ y: 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 + idx * 0.2, type: "spring", stiffness: 150 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="text-4xl">{team.emoji}</div>
                    <p className={`font-bold text-center text-sm ${rankClass}`}>
                      {team.teamName}
                      {team.teamNickname && <span className="text-[#7B8BA3] text-xs block">({team.teamNickname})</span>}
                    </p>
                    <p className={`font-mono text-sm ${rankClass}`}>{team.finalScore.toFixed(1)}</p>
                    <div className={`w-full rounded-t-lg flex items-center justify-center ${heights[idx]} bg-[#1A2235] border border-[rgba(255,215,0,0.15)]`}>
                      <span className={`font-mono font-black text-3xl ${rankClass}`}>
                        {getRankLabel(actualRank)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
            {/* Score bars */}
            {scores.map((team, i) => {
              const rankClass = getRankStyle(team.rank);
              const maxScore = scores[0]?.finalScore || 100;
              const pct = (team.finalScore / maxScore) * 100;
              return (
                <motion.div
                  key={team.teamId}
                  initial={{ x: -80, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.15, type: "spring", stiffness: 200 }}
                  className="bg-[#1A2235] rounded-xl px-5 py-3 border border-[rgba(255,215,0,0.15)]"
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
                        background: team.rank === 1 ? "#FFD700" : team.rank === 2 ? "#C0C0C0" : "#CD7F32"
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.15 + 0.3, duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </motion.div>
              );
            })}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              onClick={onComplete}
              className="mt-4 mx-auto px-8 py-3 border border-[#FFD700] text-[#FFD700] font-mono rounded-xl hover:bg-[#FFD700] hover:text-[#0A0E1A] transition-colors"
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

export function ResultReveal({ phase, p1Teams, scores, onComplete }: ResultRevealProps) {
  if (phase === "p1") {
    return <Phase1Reveal teams={p1Teams ?? []} onComplete={onComplete} />;
  }
  return <FinalReveal scores={scores ?? []} onComplete={onComplete} />;
}
