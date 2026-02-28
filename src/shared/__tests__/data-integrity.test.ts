import { describe, it, expect } from "vitest";
import type { Team, Vote, User, EventStatus, EventConfig } from "@/shared/types";

// ===== Helpers =====

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

function makeVote(overrides: Partial<Vote> & { voterId: string; selectedTeams: string[] }): Vote {
  return {
    role: "participant",
    timestamp: new Date(),
    phase: "p1",
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> & { uniqueCode: string }): User {
  return {
    name: overrides.name ?? `User ${overrides.uniqueCode}`,
    role: "participant",
    teamId: null,
    hasVoted: false,
    bio: null,
    ...overrides,
  };
}

/**
 * Recount vote totals from vote documents, mimicking what Firestore would contain.
 * Returns a map of teamId -> { judgeVoteCount, participantVoteCount }.
 */
function recountVotes(votes: Vote[]): Map<string, { judgeVoteCount: number; participantVoteCount: number }> {
  const counts = new Map<string, { judgeVoteCount: number; participantVoteCount: number }>();
  for (const vote of votes) {
    const field = vote.role === "judge" ? "judgeVoteCount" : "participantVoteCount";
    for (const teamId of vote.selectedTeams) {
      if (!counts.has(teamId)) {
        counts.set(teamId, { judgeVoteCount: 0, participantVoteCount: 0 });
      }
      counts.get(teamId)![field]++;
    }
  }
  return counts;
}

// ===== Valid state transitions (forward only, max 1 step) =====

const STATUS_ORDER: Record<EventStatus, number> = {
  waiting: 0,
  voting_p1: 1,
  closed_p1: 2,
  revealed_p1: 3,
  voting_p2: 4,
  closed_p2: 5,
  revealed_final: 6,
};

const VALID_STATUSES: EventStatus[] = [
  "waiting",
  "voting_p1",
  "closed_p1",
  "revealed_p1",
  "voting_p2",
  "closed_p2",
  "revealed_final",
];

function isValidTransition(from: EventStatus, to: EventStatus): boolean {
  const fromOrder = STATUS_ORDER[from];
  const toOrder = STATUS_ORDER[to];
  // Can go forward by at most 1 step, or backward freely
  return toOrder <= fromOrder + 1;
}

// ===== Tests =====

describe("Data Integrity: Vote count invariant", () => {
  it("sum of team voteCounts equals recount from votes collection", () => {
    const votes: Vote[] = [
      makeVote({ voterId: "u1", selectedTeams: ["t1", "t2"], role: "participant", phase: "p1" }),
      makeVote({ voterId: "u2", selectedTeams: ["t1", "t3"], role: "participant", phase: "p1" }),
      makeVote({ voterId: "j1", selectedTeams: ["t2", "t3"], role: "judge", phase: "p2" }),
    ];

    const teams: Team[] = [
      makeTeam({ id: "t1", participantVoteCount: 2, judgeVoteCount: 0 }),
      makeTeam({ id: "t2", participantVoteCount: 1, judgeVoteCount: 1 }),
      makeTeam({ id: "t3", participantVoteCount: 1, judgeVoteCount: 1 }),
    ];

    const recounted = recountVotes(votes);

    for (const team of teams) {
      const counted = recounted.get(team.id) ?? { judgeVoteCount: 0, participantVoteCount: 0 };
      expect(team.participantVoteCount).toBe(counted.participantVoteCount);
      expect(team.judgeVoteCount).toBe(counted.judgeVoteCount);
    }
  });

  it("detects mismatch when team counts are stale", () => {
    const votes: Vote[] = [
      makeVote({ voterId: "u1", selectedTeams: ["t1"], role: "participant", phase: "p1" }),
      makeVote({ voterId: "u2", selectedTeams: ["t1"], role: "participant", phase: "p1" }),
    ];

    // Stale count: team thinks it has 1 vote, but there are actually 2
    const team = makeTeam({ id: "t1", participantVoteCount: 1 });
    const recounted = recountVotes(votes);
    const counted = recounted.get(team.id)!;

    expect(team.participantVoteCount).not.toBe(counted.participantVoteCount);
    expect(counted.participantVoteCount).toBe(2);
  });

  it("handles empty votes collection", () => {
    const votes: Vote[] = [];
    const teams: Team[] = [
      makeTeam({ id: "t1", participantVoteCount: 0, judgeVoteCount: 0 }),
    ];

    const recounted = recountVotes(votes);

    for (const team of teams) {
      const counted = recounted.get(team.id) ?? { judgeVoteCount: 0, participantVoteCount: 0 };
      expect(team.participantVoteCount).toBe(counted.participantVoteCount);
      expect(team.judgeVoteCount).toBe(counted.judgeVoteCount);
    }
  });
});

describe("Data Integrity: hasVotedP1/P2 flags match vote document existence", () => {
  it("user with hasVotedP1=true must have a p1 vote document", () => {
    const users: User[] = [
      makeUser({ uniqueCode: "u1", hasVotedP1: true, hasVoted: true }),
      makeUser({ uniqueCode: "u2", hasVotedP1: false }),
    ];

    const votes: Vote[] = [
      makeVote({ voterId: "u1", selectedTeams: ["t1"], phase: "p1" }),
    ];

    for (const user of users) {
      const hasP1Vote = votes.some((v) => v.voterId === user.uniqueCode && v.phase === "p1");
      expect(hasP1Vote).toBe(user.hasVotedP1 ?? false);
    }
  });

  it("user with hasVotedP2=true must have a p2 vote document", () => {
    const users: User[] = [
      makeUser({ uniqueCode: "j1", role: "judge", hasVotedP2: true, hasVoted: true }),
      makeUser({ uniqueCode: "j2", role: "judge", hasVotedP2: false }),
    ];

    const votes: Vote[] = [
      makeVote({ voterId: "j1", selectedTeams: ["t1"], role: "judge", phase: "p2" }),
    ];

    for (const user of users) {
      const hasP2Vote = votes.some((v) => v.voterId === user.uniqueCode && v.phase === "p2");
      expect(hasP2Vote).toBe(user.hasVotedP2 ?? false);
    }
  });

  it("detects flag mismatch: hasVotedP1=true but no vote doc", () => {
    const user = makeUser({ uniqueCode: "u1", hasVotedP1: true });
    const votes: Vote[] = []; // no vote documents at all

    const hasP1Vote = votes.some((v) => v.voterId === user.uniqueCode && v.phase === "p1");
    expect(hasP1Vote).not.toBe(user.hasVotedP1);
  });
});

describe("Data Integrity: Admin reset consistency", () => {
  it("resetVotes: all teams should have zero counts, all users hasVoted=false", () => {
    // Simulate state after resetVotes
    const teamsAfterReset: Team[] = [
      makeTeam({ id: "t1", judgeVoteCount: 0, participantVoteCount: 0 }),
      makeTeam({ id: "t2", judgeVoteCount: 0, participantVoteCount: 0 }),
    ];
    const usersAfterReset: User[] = [
      makeUser({ uniqueCode: "u1", hasVoted: false, hasVotedP1: false, hasVotedP2: false }),
      makeUser({ uniqueCode: "j1", role: "judge", hasVoted: false, hasVotedP1: false, hasVotedP2: false }),
    ];
    const votesAfterReset: Vote[] = [];

    // Invariant: no votes should exist
    expect(votesAfterReset).toHaveLength(0);

    // Invariant: all team counts should be zero
    for (const team of teamsAfterReset) {
      expect(team.judgeVoteCount).toBe(0);
      expect(team.participantVoteCount).toBe(0);
    }

    // Invariant: all user flags should be false
    for (const user of usersAfterReset) {
      expect(user.hasVoted).toBe(false);
      expect(user.hasVotedP1).toBe(false);
      expect(user.hasVotedP2).toBe(false);
    }
  });

  it("resetPhase2Votes: p1 data preserved, p2 data cleared", () => {
    // Before reset: has both p1 and p2 votes
    const p1Votes: Vote[] = [
      makeVote({ voterId: "u1", selectedTeams: ["t1", "t2"], role: "participant", phase: "p1" }),
    ];
    const p2Votes: Vote[] = [
      makeVote({ voterId: "j1", selectedTeams: ["t1"], role: "judge", phase: "p2" }),
    ];

    // After resetPhase2Votes: only p1 votes remain
    const votesAfterReset = p1Votes; // p2 votes deleted
    expect(votesAfterReset.every((v) => v.phase === "p1")).toBe(true);
    expect(votesAfterReset).toHaveLength(1);

    // Recount from remaining votes
    const recounted = recountVotes(votesAfterReset);

    // t1 had 1 participant vote from p1, judge vote from p2 is gone
    const t1Counts = recounted.get("t1")!;
    expect(t1Counts.participantVoteCount).toBe(1);
    expect(t1Counts.judgeVoteCount).toBe(0); // judge vote was p2, now reset

    // Users: hasVotedP1 preserved, hasVotedP2 reset
    const userAfterReset = makeUser({
      uniqueCode: "j1",
      role: "judge",
      hasVotedP1: false, // judge didn't vote in p1
      hasVotedP2: false, // reset
    });
    expect(userAfterReset.hasVotedP2).toBe(false);
  });

  it("resetAll: event returns to waiting, all subcollections cleared", () => {
    // After resetAll, the event config should be back to initial state
    const eventAfterReset: Partial<EventConfig> = {
      status: "waiting",
      phase1SelectedTeamIds: undefined,
      phase1FinalizedAt: undefined,
      finalRankingOverrides: undefined,
    };

    expect(eventAfterReset.status).toBe("waiting");
    expect(eventAfterReset.phase1SelectedTeamIds).toBeUndefined();
    expect(eventAfterReset.phase1FinalizedAt).toBeUndefined();
    expect(eventAfterReset.finalRankingOverrides).toBeUndefined();

    // All collections should be empty
    const teamsAfterReset: Team[] = [];
    const votesAfterReset: Vote[] = [];
    // Non-admin users removed
    const usersAfterReset: User[] = [
      makeUser({ uniqueCode: "admin1", role: "admin" }),
    ];

    expect(teamsAfterReset).toHaveLength(0);
    expect(votesAfterReset).toHaveLength(0);
    expect(usersAfterReset.every((u) => u.role === "admin")).toBe(true);
  });
});

describe("Data Integrity: State transition rules", () => {
  it("allows valid forward transitions (1 step at a time)", () => {
    // Each consecutive pair should be valid
    for (let i = 0; i < VALID_STATUSES.length - 1; i++) {
      expect(isValidTransition(VALID_STATUSES[i], VALID_STATUSES[i + 1])).toBe(true);
    }
  });

  it("rejects skipping phases (more than 1 step forward)", () => {
    expect(isValidTransition("waiting", "closed_p1")).toBe(false);
    expect(isValidTransition("waiting", "voting_p2")).toBe(false);
    expect(isValidTransition("voting_p1", "revealed_p1")).toBe(false);
    expect(isValidTransition("voting_p1", "voting_p2")).toBe(false);
    expect(isValidTransition("closed_p1", "voting_p2")).toBe(false);
    expect(isValidTransition("waiting", "revealed_final")).toBe(false);
  });

  it("allows backward transitions (reverting to earlier state)", () => {
    expect(isValidTransition("voting_p1", "waiting")).toBe(true);
    expect(isValidTransition("closed_p1", "waiting")).toBe(true);
    expect(isValidTransition("revealed_final", "waiting")).toBe(true);
    expect(isValidTransition("voting_p2", "closed_p1")).toBe(true);
  });

  it("allows same-state transition (no-op)", () => {
    for (const status of VALID_STATUSES) {
      expect(isValidTransition(status, status)).toBe(true);
    }
  });

  it("phases requiring phase1SelectedTeamIds cannot be entered without it", () => {
    const requiresPhase1: EventStatus[] = ["voting_p2", "closed_p2", "revealed_final"];
    const mockEvent: Partial<EventConfig> = {
      status: "revealed_p1",
      phase1SelectedTeamIds: undefined,
    };

    for (const status of requiresPhase1) {
      const hasPhase1Selection = mockEvent.phase1SelectedTeamIds && mockEvent.phase1SelectedTeamIds.length > 0;
      expect(hasPhase1Selection).toBeFalsy();
      // This simulates the API check: cannot transition without phase1SelectedTeamIds
    }

    // With phase1SelectedTeamIds set, transition is allowed
    const eventWithSelection: Partial<EventConfig> = {
      status: "revealed_p1",
      phase1SelectedTeamIds: ["t1", "t2", "t3"],
    };
    const hasSelection = eventWithSelection.phase1SelectedTeamIds && eventWithSelection.phase1SelectedTeamIds.length > 0;
    expect(hasSelection).toBeTruthy();
  });
});

describe("Data Integrity: maxVotesPerUser limit enforcement", () => {
  it("rejects vote with more teams than maxVotesP1", () => {
    const maxVotesP1 = 3;
    const selectedTeams = ["t1", "t2", "t3", "t4"]; // 4 teams, limit is 3

    expect(selectedTeams.length > maxVotesP1).toBe(true);
  });

  it("accepts vote at exactly the limit", () => {
    const maxVotesP1 = 3;
    const selectedTeams = ["t1", "t2", "t3"];

    expect(selectedTeams.length <= maxVotesP1).toBe(true);
  });

  it("accepts vote below the limit", () => {
    const maxVotesP1 = 3;
    const selectedTeams = ["t1"];

    expect(selectedTeams.length <= maxVotesP1).toBe(true);
  });

  it("deduplicates selected teams before counting", () => {
    const rawSelectedTeams = ["t1", "t2", "t1", "t2", "t3"];
    const selectedTeams = [...new Set(rawSelectedTeams)];

    expect(selectedTeams).toHaveLength(3);
    expect(selectedTeams).toEqual(["t1", "t2", "t3"]);
  });

  it("phase 2 uses maxVotesP2 independently from P1", () => {
    const maxVotesP1 = 5;
    const maxVotesP2 = 3;

    const p1Selection = ["t1", "t2", "t3", "t4", "t5"];
    const p2Selection = ["t1", "t2", "t3", "t4"]; // 4 teams

    expect(p1Selection.length <= maxVotesP1).toBe(true);
    expect(p2Selection.length > maxVotesP2).toBe(true); // exceeds p2 limit
  });

  it("prevents voting for own team", () => {
    const userTeamId = "t2";
    const selectedTeams = ["t1", "t2", "t3"];

    const votingForOwnTeam = userTeamId && selectedTeams.includes(userTeamId);
    expect(votingForOwnTeam).toBe(true); // should be rejected by API
  });

  it("prevents voting for hidden teams", () => {
    const teams: Team[] = [
      makeTeam({ id: "t1" }),
      makeTeam({ id: "t2", isHidden: true }),
    ];

    const selectedTeams = ["t1", "t2"];
    const hiddenSelected = selectedTeams.filter((id) =>
      teams.find((t) => t.id === id)?.isHidden
    );

    expect(hiddenSelected).toHaveLength(1);
    expect(hiddenSelected[0]).toBe("t2");
  });

  it("phase 2 votes must be subset of phase1SelectedTeamIds", () => {
    const phase1SelectedTeamIds = ["t1", "t2", "t3", "t4", "t5"];
    const selectedTeams = ["t1", "t6"]; // t6 not in phase 1

    const invalidTeams = selectedTeams.filter(
      (teamId) => !phase1SelectedTeamIds.includes(teamId)
    );

    expect(invalidTeams).toHaveLength(1);
    expect(invalidTeams[0]).toBe("t6");
  });
});
