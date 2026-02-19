import { describe, it, expect } from "vitest";
import { calculateScores, getTop10 } from "../scoring";
import type { Team } from "../types";

function makeTeam(overrides: Partial<Team> & { id: string }): Team {
  return {
    name: overrides.name ?? `Team ${overrides.id}`,
    nickname: null,
    description: "",
    emoji: "🚀",
    projectUrl: null,
    memberUserIds: [],
    judgeVoteCount: 0,
    participantVoteCount: 0,
    ...overrides,
  };
}

describe("calculateScores", () => {
  it("returns empty array for no teams", () => {
    expect(calculateScores([])).toEqual([]);
  });

  it("normalizes scores relative to max votes in each group", () => {
    const teams: Team[] = [
      makeTeam({ id: "a", judgeVoteCount: 10, participantVoteCount: 20 }),
      makeTeam({ id: "b", judgeVoteCount: 5, participantVoteCount: 10 }),
    ];
    const scores = calculateScores(teams, 0.8, 0.2);

    // Team A: judge=100, participant=100 → 0.8*100 + 0.2*100 = 100
    expect(scores[0].teamId).toBe("a");
    expect(scores[0].judgeNormalized).toBe(100);
    expect(scores[0].participantNormalized).toBe(100);
    expect(scores[0].finalScore).toBe(100);

    // Team B: judge=50, participant=50 → 0.8*50 + 0.2*50 = 50
    expect(scores[1].teamId).toBe("b");
    expect(scores[1].judgeNormalized).toBe(50);
    expect(scores[1].participantNormalized).toBe(50);
    expect(scores[1].finalScore).toBe(50);
  });

  it("assigns correct ranks", () => {
    const teams: Team[] = [
      makeTeam({ id: "c", judgeVoteCount: 1, participantVoteCount: 1 }),
      makeTeam({ id: "a", judgeVoteCount: 10, participantVoteCount: 10 }),
      makeTeam({ id: "b", judgeVoteCount: 5, participantVoteCount: 5 }),
    ];
    const scores = calculateScores(teams);

    expect(scores[0].rank).toBe(1);
    expect(scores[0].teamId).toBe("a");
    expect(scores[1].rank).toBe(2);
    expect(scores[1].teamId).toBe("b");
    expect(scores[2].rank).toBe(3);
    expect(scores[2].teamId).toBe("c");
  });

  it("handles different weight distributions", () => {
    const teams: Team[] = [
      makeTeam({ id: "a", judgeVoteCount: 10, participantVoteCount: 1 }),
      makeTeam({ id: "b", judgeVoteCount: 1, participantVoteCount: 10 }),
    ];

    // Heavy judge weight: Team A should win
    const judgeHeavy = calculateScores(teams, 0.9, 0.1);
    expect(judgeHeavy[0].teamId).toBe("a");

    // Heavy participant weight: Team B should win
    const participantHeavy = calculateScores(teams, 0.1, 0.9);
    expect(participantHeavy[0].teamId).toBe("b");
  });

  it("handles team with zero votes", () => {
    const teams: Team[] = [
      makeTeam({ id: "a", judgeVoteCount: 5, participantVoteCount: 5 }),
      makeTeam({ id: "b", judgeVoteCount: 0, participantVoteCount: 0 }),
    ];
    const scores = calculateScores(teams);

    expect(scores[1].teamId).toBe("b");
    expect(scores[1].judgeNormalized).toBe(0);
    expect(scores[1].participantNormalized).toBe(0);
    expect(scores[1].finalScore).toBe(0);
  });

  it("handles single team", () => {
    const teams: Team[] = [
      makeTeam({ id: "solo", judgeVoteCount: 3, participantVoteCount: 7 }),
    ];
    const scores = calculateScores(teams, 0.5, 0.5);

    expect(scores).toHaveLength(1);
    expect(scores[0].rank).toBe(1);
    expect(scores[0].judgeNormalized).toBe(100);
    expect(scores[0].participantNormalized).toBe(100);
    expect(scores[0].finalScore).toBe(100);
  });

  it("preserves team metadata in scores", () => {
    const teams: Team[] = [
      makeTeam({
        id: "x",
        name: "Super Team",
        nickname: "ST",
        emoji: "🔥",
        judgeVoteCount: 5,
        participantVoteCount: 5,
      }),
    ];
    const scores = calculateScores(teams);

    expect(scores[0].teamName).toBe("Super Team");
    expect(scores[0].teamNickname).toBe("ST");
    expect(scores[0].emoji).toBe("🔥");
    expect(scores[0].judgeVoteCount).toBe(5);
    expect(scores[0].participantVoteCount).toBe(5);
  });

  it("uses default weights when not specified", () => {
    const teams: Team[] = [
      makeTeam({ id: "a", judgeVoteCount: 10, participantVoteCount: 10 }),
    ];
    const scores = calculateScores(teams);

    // Default: judge 0.8, participant 0.2
    // Both normalized to 100 → 0.8*100 + 0.2*100 = 100
    expect(scores[0].finalScore).toBe(100);
  });
});

describe("getTop10", () => {
  it("returns at most 10 scores", () => {
    const teams: Team[] = Array.from({ length: 15 }, (_, i) =>
      makeTeam({ id: `t${i}`, judgeVoteCount: 15 - i, participantVoteCount: 15 - i })
    );
    const scores = calculateScores(teams);
    const top10 = getTop10(scores);

    expect(top10).toHaveLength(10);
    expect(top10[0].rank).toBe(1);
    expect(top10[9].rank).toBe(10);
  });

  it("returns all if fewer than 10", () => {
    const teams: Team[] = [
      makeTeam({ id: "a", judgeVoteCount: 5, participantVoteCount: 5 }),
      makeTeam({ id: "b", judgeVoteCount: 3, participantVoteCount: 3 }),
    ];
    const scores = calculateScores(teams);
    const top10 = getTop10(scores);

    expect(top10).toHaveLength(2);
  });

  it("returns empty for empty input", () => {
    expect(getTop10([])).toEqual([]);
  });
});
