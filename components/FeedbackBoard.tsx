"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from "firebase/firestore";
import { toast } from "sonner";
import { getFirebaseDb, getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { EVENT_ID } from "@/lib/constants";
import { sendFeedback } from "@/lib/client-actions";
import type { TeamFeedback } from "@/lib/types";

interface FeedbackBoardProps {
  teamId: string;
  isTeamMember: boolean;
}

const TYPE_ICONS: Record<TeamFeedback["type"], string> = {
  cheer: "🎉",
  question: "❓",
  feedback: "💡",
};

const TYPE_LABELS: Record<TeamFeedback["type"], string> = {
  cheer: "응원",
  question: "질문",
  feedback: "피드백",
};

const TYPE_COLORS: Record<TeamFeedback["type"], string> = {
  cheer: "border-[#00FF88]/20 bg-[#00FF88]/5",
  question: "border-[#4DAFFF]/20 bg-[#4DAFFF]/5",
  feedback: "border-[#FF6B35]/20 bg-[#FF6B35]/5",
};

export function FeedbackBoard({ teamId, isTeamMember }: FeedbackBoardProps) {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<TeamFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [type, setType] = useState<TeamFeedback["type"]>("cheer");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  useEffect(() => {
    const db = getFirebaseDb();
    const feedbacksRef = collection(
      db,
      `events/${EVENT_ID}/teams/${teamId}/feedbacks`
    );
    const q = query(feedbacksRef, orderBy("createdAt", "desc"), limit(20));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: TeamFeedback[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          teamId,
          text: data.text,
          type: data.type,
          anonymous: data.anonymous,
          senderName: data.senderName,
          createdAt: data.createdAt instanceof Timestamp
            ? data.createdAt.toDate()
            : new Date(data.createdAt),
          reply: data.reply ?? null,
          repliedAt: data.repliedAt instanceof Timestamp
            ? data.repliedAt.toDate()
            : data.repliedAt ? new Date(data.repliedAt) : null,
        };
      });
      setFeedbacks(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;

    setSubmitting(true);
    try {
      await sendFeedback(teamId, text.trim(), type, anonymous, {
        uid: user.uid,
        name: user.name,
      });

      setText("");
      toast.success("피드백이 전송되었습니다!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "피드백 전송에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (feedbackId: string) => {
    const replyText = replyInputs[feedbackId];
    if (!replyText?.trim()) return;

    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      if (!token) throw new Error("인증 토큰을 가져올 수 없습니다");

      const res = await fetch("/api/feedback", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teamId, feedbackId, reply: replyText.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "답글 작성에 실패했습니다");

      setReplyInputs((prev) => ({ ...prev, [feedbackId]: "" }));
      setReplyingTo(null);
      toast.success("답글이 등록되었습니다!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "답글 작성에 실패했습니다");
    }
  };

  return (
    <div className="space-y-4">
      {/* Feedback Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Type selector */}
        <div className="flex gap-2">
          {(["cheer", "question", "feedback"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md border font-mono text-xs transition-colors ${
                type === t
                  ? t === "cheer"
                    ? "border-[#00FF88]/60 bg-[#00FF88]/10 text-[#00FF88]"
                    : t === "question"
                    ? "border-[#4DAFFF]/60 bg-[#4DAFFF]/10 text-[#4DAFFF]"
                    : "border-[#FF6B35]/60 bg-[#FF6B35]/10 text-[#FF6B35]"
                  : "border-border/40 bg-background/50 text-muted-foreground hover:border-border"
              }`}
            >
              <span>{TYPE_ICONS[t]}</span>
              <span>{TYPE_LABELS[t]}</span>
            </button>
          ))}
        </div>

        {/* Text input */}
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="팀에게 메시지를 남겨보세요..."
            className="w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 resize-none transition-colors"
          />
          <span className="absolute bottom-2 right-2 text-xs text-muted-foreground/50 font-mono">
            {text.length}/200
          </span>
        </div>

        {/* Bottom row: anonymous toggle + submit */}
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div
              onClick={() => setAnonymous(!anonymous)}
              className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${
                anonymous ? "bg-primary/60" : "bg-border/60"
              }`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                  anonymous ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors">
              익명
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="px-4 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-primary font-mono text-xs hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "$ sending..." : "$ send"}
          </button>
        </div>
      </form>

      {/* Divider */}
      <div className="border-t border-border/30" />

      {/* Feedback list */}
      {loading ? (
        <div className="text-center py-4">
          <span className="font-mono text-xs text-muted-foreground animate-pulse">
            {"// loading feedbacks..."}
          </span>
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="text-center py-4">
          <span className="font-mono text-xs text-muted-foreground">
            {"// 아직 피드백이 없습니다"}
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {feedbacks.map((fb) => (
              <motion.div
                key={fb.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className={`rounded-lg border p-3 space-y-2 ${TYPE_COLORS[fb.type]}`}
              >
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="text-base">{TYPE_ICONS[fb.type]}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {fb.anonymous || !fb.senderName ? "익명" : fb.senderName}
                  </span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground/50">
                    {fb.createdAt.toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Text */}
                <p className="text-sm text-foreground leading-relaxed">{fb.text}</p>

                {/* Reply */}
                {fb.reply && (
                  <div className="pl-3 border-l-2 border-[#4DAFFF]/40 mt-2">
                    <p className="text-xs font-mono text-[#4DAFFF]/80 mb-0.5">
                      {"// 팀 답글"}
                    </p>
                    <p className="text-sm text-[#4DAFFF]/90">{fb.reply}</p>
                  </div>
                )}

                {/* Reply input for team members */}
                {isTeamMember && !fb.reply && (
                  <div className="mt-1">
                    {replyingTo === fb.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={replyInputs[fb.id] || ""}
                          onChange={(e) =>
                            setReplyInputs((prev) => ({
                              ...prev,
                              [fb.id]: e.target.value,
                            }))
                          }
                          rows={2}
                          placeholder="답글을 입력하세요..."
                          className="w-full rounded-md border border-[#4DAFFF]/30 bg-[#4DAFFF]/5 px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#4DAFFF]/60 resize-none transition-colors"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setReplyingTo(null)}
                            className="flex-1 px-2 py-1 rounded border border-border/40 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReply(fb.id)}
                            disabled={!replyInputs[fb.id]?.trim()}
                            className="flex-1 px-2 py-1 rounded border border-[#4DAFFF]/30 bg-[#4DAFFF]/10 text-xs font-mono text-[#4DAFFF] hover:bg-[#4DAFFF]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            $ reply
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReplyingTo(fb.id)}
                        className="text-xs font-mono text-muted-foreground/60 hover:text-[#4DAFFF]/80 transition-colors"
                      >
                        {"// 답글 달기"}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
