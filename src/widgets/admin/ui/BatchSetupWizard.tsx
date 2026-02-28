"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { TEAM_EMOJIS } from "@/shared/config/constants";
import { toast } from "sonner";

interface BatchSetupWizardProps {
  onComplete: () => void;
  callAdminApi: (action: string, data: Record<string, unknown>) => Promise<BatchResult>;
}

interface ConfigState {
  teamCount: number;
  participantsPerTeam: number;
  judgeCount: number;
  teamPrefix: string;
}

interface CreatedMember {
  code: string;
  name: string;
}

interface CreatedTeam {
  id: string;
  name: string;
  emoji: string;
  members: CreatedMember[];
}

interface BatchResult {
  teams: CreatedTeam[];
  judges: CreatedMember[];
  summary: {
    teamCount: number;
    participantCount: number;
    judgeCount: number;
  };
}

const STEP_LABELS = ["설정", "미리보기", "결과"];

export default function BatchSetupWizard({ onComplete, callAdminApi }: BatchSetupWizardProps) {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<ConfigState>({
    teamCount: 25,
    participantsPerTeam: 2,
    judgeCount: 5,
    teamPrefix: "팀",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);

  const totalParticipants = config.teamCount * config.participantsPerTeam;

  // Build preview data from config
  const previewTeams = Array.from({ length: Math.min(config.teamCount, 100) }, (_, i) => ({
    index: i + 1,
    name: `${config.teamPrefix} ${i + 1}`,
    emoji: TEAM_EMOJIS[i % TEAM_EMOJIS.length],
    members: Array.from({ length: config.participantsPerTeam }, (_, j) => ({
      name: `참가자 ${i * config.participantsPerTeam + j + 1}`,
    })),
  }));

  const handleExecute = async () => {
    setLoading(true);
    try {
      const res = await callAdminApi("batchSetup", {
        teamCount: config.teamCount,
        participantsPerTeam: config.participantsPerTeam,
        judgeCount: config.judgeCount,
        teamPrefix: config.teamPrefix,
      });
      setResult(res);
      setStep(2);
      toast.success(`${res.summary.teamCount}개 팀, ${res.summary.participantCount}명 참가자, ${res.summary.judgeCount}명 심사위원이 생성되었습니다.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("클립보드에 복사되었습니다.");
  };

  const copyAllCodes = () => {
    if (!result) return;
    const lines: string[] = [];
    for (const team of result.teams) {
      for (const member of team.members) {
        lines.push(`${member.code}\t${member.name}\tparticipant\t${team.name}`);
      }
    }
    for (const judge of result.judges) {
      lines.push(`${judge.code}\t${judge.name}\tjudge\t`);
    }
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success(`${lines.length}개의 코드가 복사되었습니다.`);
  };

  const downloadCsv = () => {
    if (!result) return;
    const rows = ["code,name,role,team"];
    for (const team of result.teams) {
      for (const member of team.members) {
        rows.push(`${member.code},${member.name},participant,${team.name}`);
      }
    }
    for (const judge of result.judges) {
      rows.push(`${judge.code},${judge.name},judge,`);
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gdg-busan-codes.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV 파일이 다운로드되었습니다.");
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="bg-[#1A2235] rounded-xl p-6 border border-[#00FF88]/10">
        <div className="flex items-center justify-center gap-0">
          {STEP_LABELS.map((label, idx) => (
            <div key={idx} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-sm border-2 transition-all ${
                    idx < step
                      ? "bg-[#00FF88]/20 border-[#00FF88] text-[#00FF88]"
                      : idx === step
                      ? "bg-[#00FF88] border-[#00FF88] text-[#0A0E1A]"
                      : "bg-transparent border-gray-600 text-gray-500"
                  }`}
                >
                  {idx < step ? "✓" : idx + 1}
                </div>
                <span
                  className={`font-mono text-xs ${
                    idx === step ? "text-[#00FF88]" : "text-gray-500"
                  }`}
                >
                  {label}
                </span>
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div
                  className={`w-16 h-px mx-2 mb-5 transition-all ${
                    idx < step ? "bg-[#00FF88]/50" : "bg-gray-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Configuration */}
      {step === 0 && (
        <div className="bg-[#1A2235] rounded-xl p-6 border border-[#00FF88]/10 space-y-6">
          <h2 className="text-[#00FF88] font-mono font-semibold">일괄 생성 설정</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="text-gray-400 font-mono text-xs block mb-1.5">팀 수</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={config.teamCount}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, teamCount: parseInt(e.target.value) || 1 }))
                }
                className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
              />
            </div>
            <div>
              <label className="text-gray-400 font-mono text-xs block mb-1.5">팀당 참가자 수</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={config.participantsPerTeam}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, participantsPerTeam: parseInt(e.target.value) || 1 }))
                }
                className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
              />
            </div>
            <div>
              <label className="text-gray-400 font-mono text-xs block mb-1.5">심사위원 수</label>
              <Input
                type="number"
                min={0}
                max={50}
                value={config.judgeCount}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, judgeCount: parseInt(e.target.value) || 0 }))
                }
                className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
              />
            </div>
            <div>
              <label className="text-gray-400 font-mono text-xs block mb-1.5">팀 이름 접두사</label>
              <Input
                type="text"
                value={config.teamPrefix}
                onChange={(e) => setConfig((p) => ({ ...p, teamPrefix: e.target.value }))}
                placeholder="팀"
                className="font-mono bg-[#0A0E1A] border-[#00FF88]/20"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-[#0A0E1A] rounded-lg p-4 border border-[#00FF88]/10">
            <p className="text-gray-300 font-mono text-sm">
              <span className="text-[#00FF88] font-bold">{config.teamCount}개 팀</span>
              {", "}
              <span className="text-[#4DAFFF] font-bold">{totalParticipants}명 참가자</span>
              {", "}
              <span className="text-[#FF6B35] font-bold">{config.judgeCount}명 심사위원</span>
              이 생성됩니다
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => setStep(1)}
              className="font-mono bg-[#00FF88] text-[#0A0E1A] hover:bg-[#00FF88]/90 font-semibold"
            >
              다음 &rarr;
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 1 && (
        <div className="bg-[#1A2235] rounded-xl p-6 border border-[#00FF88]/10 space-y-5">
          <h2 className="text-[#00FF88] font-mono font-semibold">생성 미리보기</h2>

          <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
            {previewTeams.map((team) => (
              <div
                key={team.index}
                className="bg-[#0A0E1A] rounded-lg px-4 py-3 border border-[#00FF88]/5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{team.emoji}</span>
                  <span className="text-white font-mono font-semibold text-sm">{team.name}</span>
                </div>
                <div className="text-gray-400 font-mono text-xs pl-7">
                  멤버: {team.members.map((m) => m.name).join(", ")}
                </div>
              </div>
            ))}

            {/* Judges Preview */}
            <div className="bg-[#0A0E1A] rounded-lg px-4 py-3 border border-[#FF6B35]/10 mt-3">
              <div className="text-[#FF6B35] font-mono font-semibold text-sm mb-1">심사위원</div>
              <div className="text-gray-400 font-mono text-xs">
                {Array.from({ length: config.judgeCount }, (_, i) => `심사위원 ${i + 1}`).join(", ")}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => setStep(0)}
              className="font-mono border-gray-600 text-gray-400 hover:border-[#00FF88]/50 hover:text-[#00FF88]"
            >
              &larr; 이전
            </Button>
            <Button
              onClick={handleExecute}
              disabled={loading}
              className="font-mono bg-[#00FF88] text-[#0A0E1A] hover:bg-[#00FF88]/90 font-semibold min-w-[110px]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3.5 h-3.5 border-2 border-[#0A0E1A] border-t-transparent rounded-full animate-spin" />
                  생성 중...
                </span>
              ) : (
                "생성 실행"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 2 && result && (
        <div className="space-y-6">
          {/* Success Summary */}
          <div className="bg-[#00FF88]/10 rounded-xl p-5 border border-[#00FF88]/30">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[#00FF88] text-xl">&#10003;</span>
              <h2 className="text-[#00FF88] font-mono font-semibold text-lg">생성 완료</h2>
            </div>
            <p className="text-gray-300 font-mono text-sm">
              <span className="text-[#00FF88] font-bold">{result.summary.teamCount}개 팀</span>
              {", "}
              <span className="text-[#4DAFFF] font-bold">{result.summary.participantCount}명 참가자</span>
              {", "}
              <span className="text-[#FF6B35] font-bold">{result.summary.judgeCount}명 심사위원</span>
              이 생성되었습니다.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={copyAllCodes}
              className="font-mono border-[#00FF88]/30 text-[#00FF88] hover:bg-[#00FF88]/10"
            >
              전체 코드 복사
            </Button>
            <Button
              variant="outline"
              onClick={downloadCsv}
              className="font-mono border-[#4DAFFF]/30 text-[#4DAFFF] hover:bg-[#4DAFFF]/10"
            >
              CSV 다운로드
            </Button>
            <Button
              onClick={onComplete}
              className="font-mono bg-[#00FF88] text-[#0A0E1A] hover:bg-[#00FF88]/90 font-semibold ml-auto"
            >
              팀 관리로 이동 &rarr;
            </Button>
          </div>

          {/* Teams & Codes */}
          <div className="space-y-3">
            {result.teams.map((team) => (
              <div
                key={team.id}
                className="bg-[#1A2235] rounded-xl p-4 border border-[#00FF88]/10"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{team.emoji}</span>
                  <span className="text-white font-mono font-semibold">{team.name}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {team.members.map((member) => (
                    <button
                      key={member.code}
                      onClick={() => copyCode(member.code)}
                      title="클릭하여 복사"
                      className="bg-[#0A0E1A] rounded-lg px-3 py-1.5 border border-[#00FF88]/10 hover:border-[#00FF88]/40 transition-all group"
                    >
                      <div className="text-[#00FF88] font-mono text-xs font-bold group-hover:text-[#00FF88]">
                        {member.code}
                      </div>
                      <div className="text-gray-400 font-mono text-xs">{member.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Judges */}
            {result.judges.length > 0 && (
              <div className="bg-[#1A2235] rounded-xl p-4 border border-[#FF6B35]/10">
                <div className="text-[#FF6B35] font-mono font-semibold mb-3">심사위원</div>
                <div className="flex flex-wrap gap-2">
                  {result.judges.map((judge) => (
                    <button
                      key={judge.code}
                      onClick={() => copyCode(judge.code)}
                      title="클릭하여 복사"
                      className="bg-[#0A0E1A] rounded-lg px-3 py-1.5 border border-[#FF6B35]/10 hover:border-[#FF6B35]/40 transition-all group"
                    >
                      <div className="text-[#FF6B35] font-mono text-xs font-bold">
                        {judge.code}
                      </div>
                      <div className="text-gray-400 font-mono text-xs">{judge.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
