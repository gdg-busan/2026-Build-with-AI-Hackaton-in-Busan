import { describe, it, expect } from "vitest";
import {
  calculateScores,
  getTop10,
  getPhase1Results,
  calculateFinalScores,
  detectFinalTies,
  applyFinalRankingOverrides,
} from "../scoring";
import type { Team, TeamScore } from "../types";

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

  it("excludes hidden teams from scoring", () => {
    const teams: Team[] = [
      makeTeam({ id: "a", judgeVoteCount: 10, participantVoteCount: 10 }),
      makeTeam({ id: "hidden", judgeVoteCount: 20, participantVoteCount: 20, isHidden: true }),
      makeTeam({ id: "b", judgeVoteCount: 5, participantVoteCount: 5 }),
    ];
    const scores = calculateScores(teams);

    // Hidden team should be excluded
    expect(scores).toHaveLength(2);
    expect(scores.find((s) => s.teamId === "hidden")).toBeUndefined();

    // Team A should still be rank 1 (max votes among visible teams)
    expect(scores[0].teamId).toBe("a");
    expect(scores[0].judgeNormalized).toBe(100);
    expect(scores[0].rank).toBe(1);
  });

  it("normalizes correctly when all teams have zero votes (0/0 defense)", () => {
    const teams: Team[] = [
      makeTeam({ id: "a", judgeVoteCount: 0, participantVoteCount: 0 }),
      makeTeam({ id: "b", judgeVoteCount: 0, participantVoteCount: 0 }),
    ];
    const scores = calculateScores(teams);

    // Math.max(...[0, 0], 1) = 1, so 0/1 = 0, no NaN/Infinity
    expect(scores).toHaveLength(2);
    for (const s of scores) {
      expect(s.judgeNormalized).toBe(0);
      expect(s.participantNormalized).toBe(0);
      expect(s.finalScore).toBe(0);
      expect(Number.isFinite(s.finalScore)).toBe(true);
    }
  });

  it("single voter normalization: sole team with votes gets 100", () => {
    const teams: Team[] = [
      makeTeam({ id: "a", judgeVoteCount: 1, participantVoteCount: 0 }),
      makeTeam({ id: "b", judgeVoteCount: 0, participantVoteCount: 1 }),
    ];
    const scores = calculateScores(teams, 0.5, 0.5);

    // Team A: judge=100 (1/1*100), participant=0 → 50
    const scoreA = scores.find((s) => s.teamId === "a")!;
    expect(scoreA.judgeNormalized).toBe(100);
    expect(scoreA.participantNormalized).toBe(0);
    expect(scoreA.finalScore).toBe(50);

    // Team B: judge=0, participant=100 → 50
    const scoreB = scores.find((s) => s.teamId === "b")!;
    expect(scoreB.judgeNormalized).toBe(0);
    expect(scoreB.participantNormalized).toBe(100);
    expect(scoreB.finalScore).toBe(50);
  });

  it("weight constraint: judgeWeight + participantWeight should equal 1 for proper scoring", () => {
    const teams: Team[] = [
      makeTeam({ id: "a", judgeVoteCount: 10, participantVoteCount: 10 }),
    ];

    // When weights sum to 1, max possible score is 100
    const balanced = calculateScores(teams, 0.5, 0.5);
    expect(balanced[0].finalScore).toBe(100);

    // When weights don't sum to 1, max score deviates
    const overweight = calculateScores(teams, 0.8, 0.8);
    expect(overweight[0].finalScore).toBe(160); // exceeds 100

    const underweight = calculateScores(teams, 0.3, 0.2);
    expect(underweight[0].finalScore).toBe(50); // below 100
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

describe("getPhase1Results - tie-breaking at TOP10 boundary", () => {
  it("detects tie at boundary when 10th and 11th place have same votes", () => {
    // 9 teams clearly above, then 3 teams tied at the cutoff
    const teams: Team[] = [
      ...Array.from({ length: 9 }, (_, i) =>
        makeTeam({ id: `top${i}`, participantVoteCount: 20 - i })
      ),
      makeTeam({ id: "tied1", participantVoteCount: 5 }),
      makeTeam({ id: "tied2", participantVoteCount: 5 }),
      makeTeam({ id: "tied3", participantVoteCount: 5 }),
    ];

    const result = getPhase1Results(teams, 10);

    // 9 teams clearly selected, 3 teams tied at boundary
    expect(result.selectedTeamIds).toHaveLength(9);
    expect(result.tiedTeams).not.toBeNull();
    expect(result.tiedTeams!).toHaveLength(3);
    expect(result.tiedTeams!.map((t) => t.id).sort()).toEqual(["tied1", "tied2", "tied3"]);
  });

  it("no tie when 10th and 11th have different votes", () => {
    const teams: Team[] = Array.from({ length: 15 }, (_, i) =>
      makeTeam({ id: `t${i}`, participantVoteCount: 15 - i })
    );

    const result = getPhase1Results(teams, 10);

    expect(result.selectedTeamIds).toHaveLength(10);
    expect(result.tiedTeams).toBeNull();
  });

  it("returns all teams when total <= topN", () => {
    const teams: Team[] = Array.from({ length: 8 }, (_, i) =>
      makeTeam({ id: `t${i}`, participantVoteCount: 10 - i })
    );

    const result = getPhase1Results(teams, 10);

    expect(result.selectedTeamIds).toHaveLength(8);
    expect(result.tiedTeams).toBeNull();
  });

  it("excludes hidden teams from phase1 results", () => {
    const teams: Team[] = [
      ...Array.from({ length: 10 }, (_, i) =>
        makeTeam({ id: `t${i}`, participantVoteCount: 20 - i })
      ),
      makeTeam({ id: "hidden", participantVoteCount: 100, isHidden: true }),
    ];

    const result = getPhase1Results(teams, 10);

    expect(result.selectedTeamIds).toHaveLength(10);
    expect(result.selectedTeamIds).not.toContain("hidden");
  });

  it("detects tied groups within selected teams", () => {
    // Two pairs of teams with the same vote count, all within top 10
    const teams: Team[] = [
      makeTeam({ id: "t1", participantVoteCount: 10 }),
      makeTeam({ id: "t2", participantVoteCount: 10 }),
      makeTeam({ id: "t3", participantVoteCount: 5 }),
      makeTeam({ id: "t4", participantVoteCount: 5 }),
      makeTeam({ id: "t5", participantVoteCount: 1 }),
    ];

    const result = getPhase1Results(teams, 10);

    expect(result.hasTiedGroups).toBe(true);
    expect(result.tiedGroups).toHaveLength(2);
    expect(result.tiedGroups[0].voteCount).toBe(10);
    expect(result.tiedGroups[0].teams).toHaveLength(2);
    expect(result.tiedGroups[1].voteCount).toBe(5);
    expect(result.tiedGroups[1].teams).toHaveLength(2);
  });
});

describe("calculateFinalScores", () => {
  it("only scores teams in phase1SelectedTeamIds", () => {
    const teams: Team[] = [
      makeTeam({ id: "a", judgeVoteCount: 10, participantVoteCount: 10 }),
      makeTeam({ id: "b", judgeVoteCount: 5, participantVoteCount: 5 }),
      makeTeam({ id: "c", judgeVoteCount: 8, participantVoteCount: 8 }),
    ];

    const scores = calculateFinalScores(teams, 0.8, 0.2, ["a", "c"]);

    expect(scores).toHaveLength(2);
    expect(scores.map((s) => s.teamId)).toContain("a");
    expect(scores.map((s) => s.teamId)).toContain("c");
    expect(scores.map((s) => s.teamId)).not.toContain("b");
  });

  it("returns empty array when no teams match phase1SelectedTeamIds", () => {
    const teams: Team[] = [
      makeTeam({ id: "a", judgeVoteCount: 10, participantVoteCount: 10 }),
    ];

    const scores = calculateFinalScores(teams, 0.8, 0.2, ["nonexistent"]);
    expect(scores).toEqual([]);
  });

  it("excludes hidden teams even if in phase1SelectedTeamIds", () => {
    const teams: Team[] = [
      makeTeam({ id: "a", judgeVoteCount: 10, participantVoteCount: 10 }),
      makeTeam({ id: "b", judgeVoteCount: 5, participantVoteCount: 5, isHidden: true }),
    ];

    const scores = calculateFinalScores(teams, 0.8, 0.2, ["a", "b"]);

    expect(scores).toHaveLength(1);
    expect(scores[0].teamId).toBe("a");
  });
});

describe("detectFinalTies", () => {
  it("detects tied teams with same final score", () => {
    const scores: TeamScore[] = [
      { teamId: "a", teamName: "A", teamNickname: null, emoji: "🚀", judgeVoteCount: 10, participantVoteCount: 10, judgeNormalized: 100, participantNormalized: 100, finalScore: 100, rank: 1 },
      { teamId: "b", teamName: "B", teamNickname: null, emoji: "🚀", judgeVoteCount: 10, participantVoteCount: 10, judgeNormalized: 100, participantNormalized: 100, finalScore: 100, rank: 2 },
      { teamId: "c", teamName: "C", teamNickname: null, emoji: "🚀", judgeVoteCount: 5, participantVoteCount: 5, judgeNormalized: 50, participantNormalized: 50, finalScore: 50, rank: 3 },
    ];

    const { tiedTeams, tieGroups } = detectFinalTies(scores);

    expect(tiedTeams).not.toBeNull();
    expect(tiedTeams!).toHaveLength(2);
    expect(tieGroups).toHaveLength(1);
    expect(tieGroups[0].teams.map((t) => t.teamId).sort()).toEqual(["a", "b"]);
  });

  it("returns null when no ties", () => {
    const scores: TeamScore[] = [
      { teamId: "a", teamName: "A", teamNickname: null, emoji: "🚀", judgeVoteCount: 10, participantVoteCount: 10, judgeNormalized: 100, participantNormalized: 100, finalScore: 100, rank: 1 },
      { teamId: "b", teamName: "B", teamNickname: null, emoji: "🚀", judgeVoteCount: 5, participantVoteCount: 5, judgeNormalized: 50, participantNormalized: 50, finalScore: 50, rank: 2 },
    ];

    const { tiedTeams, tieGroups } = detectFinalTies(scores);
    expect(tiedTeams).toBeNull();
    expect(tieGroups).toEqual([]);
  });

  it("filters ties by topN when specified", () => {
    const scores: TeamScore[] = [
      { teamId: "a", teamName: "A", teamNickname: null, emoji: "🚀", judgeVoteCount: 10, participantVoteCount: 10, judgeNormalized: 100, participantNormalized: 100, finalScore: 100, rank: 1 },
      { teamId: "b", teamName: "B", teamNickname: null, emoji: "🚀", judgeVoteCount: 5, participantVoteCount: 5, judgeNormalized: 50, participantNormalized: 50, finalScore: 50, rank: 2 },
      // Tie at rank 4 and 5 (outside top 3)
      { teamId: "c", teamName: "C", teamNickname: null, emoji: "🚀", judgeVoteCount: 3, participantVoteCount: 3, judgeNormalized: 30, participantNormalized: 30, finalScore: 30, rank: 3 },
      { teamId: "d", teamName: "D", teamNickname: null, emoji: "🚀", judgeVoteCount: 1, participantVoteCount: 1, judgeNormalized: 10, participantNormalized: 10, finalScore: 10, rank: 4 },
      { teamId: "e", teamName: "E", teamNickname: null, emoji: "🚀", judgeVoteCount: 1, participantVoteCount: 1, judgeNormalized: 10, participantNormalized: 10, finalScore: 10, rank: 5 },
    ];

    // Without topN: detect tie at rank 4-5
    const all = detectFinalTies(scores);
    expect(all.tiedTeams).not.toBeNull();

    // With topN=3: tie at rank 4-5 should be filtered out
    const top3 = detectFinalTies(scores, 3);
    expect(top3.tiedTeams).toBeNull();
  });

  it("handles single team (no tie possible)", () => {
    const scores: TeamScore[] = [
      { teamId: "a", teamName: "A", teamNickname: null, emoji: "🚀", judgeVoteCount: 10, participantVoteCount: 10, judgeNormalized: 100, participantNormalized: 100, finalScore: 100, rank: 1 },
    ];

    const { tiedTeams } = detectFinalTies(scores);
    expect(tiedTeams).toBeNull();
  });
});

describe("applyFinalRankingOverrides (resolveFinalTies)", () => {
  const baseScores: TeamScore[] = [
    { teamId: "a", teamName: "A", teamNickname: null, emoji: "🚀", judgeVoteCount: 10, participantVoteCount: 10, judgeNormalized: 100, participantNormalized: 100, finalScore: 100, rank: 1 },
    { teamId: "b", teamName: "B", teamNickname: null, emoji: "🚀", judgeVoteCount: 10, participantVoteCount: 10, judgeNormalized: 100, participantNormalized: 100, finalScore: 100, rank: 2 },
    { teamId: "c", teamName: "C", teamNickname: null, emoji: "🚀", judgeVoteCount: 5, participantVoteCount: 5, judgeNormalized: 50, participantNormalized: 50, finalScore: 50, rank: 3 },
  ];

  it("reorders tied teams according to override order", () => {
    // Override: b should be rank 1, a should be rank 2
    const result = applyFinalRankingOverrides(baseScores, ["b", "a"]);

    expect(result[0].teamId).toBe("b");
    expect(result[0].rank).toBe(1);
    expect(result[1].teamId).toBe("a");
    expect(result[1].rank).toBe(2);
    // Non-overridden team keeps rank
    expect(result[2].teamId).toBe("c");
    expect(result[2].rank).toBe(3);
  });

  it("returns original scores when overrides array is empty", () => {
    const result = applyFinalRankingOverrides(baseScores, []);

    expect(result[0].teamId).toBe("a");
    expect(result[0].rank).toBe(1);
    expect(result[1].teamId).toBe("b");
    expect(result[1].rank).toBe(2);
  });

  it("throws on non-existent team IDs in overrides (filter uses !== null but find returns undefined)", () => {
    // BUG: Array.find() returns undefined when not found, but the filter
    // checks `s !== null`. undefined !== null is true, so undefined passes
    // through and crashes on .rank access.
    expect(() =>
      applyFinalRankingOverrides(baseScores, ["nonexistent", "b"])
    ).toThrow();
  });

  it("handles duplicate team IDs in overrides", () => {
    const result = applyFinalRankingOverrides(baseScores, ["a", "a"]);

    // Should not crash, all teams still present
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.teamId).sort()).toEqual(["a", "b", "c"]);
  });
});
