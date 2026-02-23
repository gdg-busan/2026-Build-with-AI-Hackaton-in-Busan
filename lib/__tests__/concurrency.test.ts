import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock firebase-admin modules BEFORE importing route handlers
// ---------------------------------------------------------------------------

const mockVerifyIdToken = vi.fn();

const mockDocGet = vi.fn();
const mockGetAll = vi.fn();
const mockRunTransaction = vi.fn();
const mockDoc = vi.fn();

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    increment: (n: number) => ({ __increment: n }),
    serverTimestamp: () => ({ __serverTimestamp: true }),
    arrayRemove: (v: string) => ({ __arrayRemove: v }),
    arrayUnion: (v: string) => ({ __arrayUnion: v }),
    delete: () => ({ __delete: true }),
  },
  getFirestore: () => ({}),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({}),
}));

vi.mock("firebase-admin/app", () => ({
  initializeApp: () => ({}),
  getApps: () => [{}],
  cert: () => ({}),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
  },
  adminDb: {
    doc: (...args: unknown[]) => mockDoc(...args),
    getAll: (...args: unknown[]) => mockGetAll(...args),
    runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  },
}));

vi.mock("@/lib/constants", () => ({
  EVENT_ID: "test-event",
  generateUniqueCode: (prefix: string, idx: number) => `${prefix}-${idx}`,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextReq(
  url: string,
  options: {
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
) {
  const { headers = {}, body } = options;
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

async function getVoteHandler() {
  const mod = await import("@/app/api/vote/route");
  return mod.POST;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Concurrency Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Same user double voting (concurrent) -> only 1 success, other 409
  // =========================================================================
  describe("Same user double voting", () => {
    it("allows first vote and rejects second via transaction ALREADY_VOTED", async () => {
      const POST = await getVoteHandler();

      // Auth succeeds for both requests
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-1",
        role: "participant",
        teamId: "team-1",
      });

      // Event doc: voting_p1
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          status: "voting_p1",
          maxVotesP1: 3,
        }),
      });

      // Mock doc() to return proper refs
      mockDoc.mockReturnValue({
        id: "doc-id",
        get: mockDocGet,
      });

      // All teams exist and are not hidden
      mockGetAll.mockResolvedValue([
        { exists: true, id: "team-2", data: () => ({ isHidden: false }) },
      ]);

      // First call: transaction succeeds (user has not voted yet)
      mockRunTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ hasVotedP1: false }),
          }),
          set: vi.fn(),
          update: vi.fn(),
        };
        await fn(tx);
      });

      // Second call: transaction finds user already voted
      mockRunTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ hasVotedP1: true }),
          }),
          set: vi.fn(),
          update: vi.fn(),
        };
        await fn(tx);
      });

      // Execute sequentially to ensure deterministic ordering
      const req1 = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer token-1" },
        body: { selectedTeams: ["team-2"] },
      });
      const res1 = await POST(req1);

      const req2 = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer token-1" },
        body: { selectedTeams: ["team-2"] },
      });
      const res2 = await POST(req2);

      // First succeeds, second is conflict
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(409);
    });

    it("transaction-level protection: ALREADY_VOTED error returns 409", async () => {
      const POST = await getVoteHandler();

      mockVerifyIdToken.mockResolvedValue({
        uid: "user-dup",
        role: "participant",
        teamId: "team-1",
      });

      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          status: "voting_p1",
          maxVotesP1: 3,
        }),
      });

      mockDoc.mockReturnValue({
        id: "doc-id",
        get: mockDocGet,
      });

      mockGetAll.mockResolvedValue([
        { exists: true, id: "team-2", data: () => ({ isHidden: false }) },
      ]);

      // Transaction always sees hasVotedP1 = true (already voted)
      mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ hasVotedP1: true }),
          }),
          set: vi.fn(),
          update: vi.fn(),
        };
        await fn(tx);
      });

      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer token-dup" },
        body: { selectedTeams: ["team-2"] },
      });

      const res = await POST(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain("이미 투표");
    });
  });

  // =========================================================================
  // 2. Multiple users voting for same team -> accurate voteCount
  // =========================================================================
  describe("Multiple users voting for same team", () => {
    it("all concurrent votes succeed independently", async () => {
      const POST = await getVoteHandler();

      const userIds = ["user-A", "user-B", "user-C", "user-D", "user-E"];
      let userIndex = 0;

      // Each call returns a different user
      mockVerifyIdToken.mockImplementation(async () => {
        const uid = userIds[userIndex++];
        return {
          uid,
          role: "participant",
          teamId: `own-team-${uid}`, // each user has own team, not the target
        };
      });

      // Event in voting_p1
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          status: "voting_p1",
          maxVotesP1: 3,
        }),
      });

      mockDoc.mockReturnValue({
        id: "doc-id",
        get: mockDocGet,
      });

      // Target team exists and not hidden
      mockGetAll.mockResolvedValue([
        { exists: true, id: "popular-team", data: () => ({ isHidden: false }) },
      ]);

      // Track transaction calls and team increments
      const teamIncrements: string[] = [];
      mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ hasVotedP1: false }),
          }),
          set: vi.fn(),
          update: vi.fn((_ref: unknown, data: Record<string, unknown>) => {
            if (data.participantVoteCount) {
              teamIncrements.push("increment");
            }
          }),
        };
        await fn(tx);
      });

      // Fire 5 concurrent vote requests
      const requests = userIds.map((_, i) =>
        nextReq("http://localhost/api/vote", {
          headers: { Authorization: `Bearer token-${i}` },
          body: { selectedTeams: ["popular-team"] },
        })
      );

      const responses = await Promise.all(requests.map((req) => POST(req)));

      // All 5 should succeed
      responses.forEach((res) => {
        expect(res.status).toBe(200);
      });

      // Transaction should be called 5 times
      expect(mockRunTransaction).toHaveBeenCalledTimes(5);

      // Each transaction should have incremented the vote count
      expect(teamIncrements).toHaveLength(5);
    });
  });

  // =========================================================================
  // 3. Status change race condition during voting
  // =========================================================================
  describe("Status change race condition", () => {
    it("rejects vote when event status changes to non-voting during request", async () => {
      const POST = await getVoteHandler();

      mockVerifyIdToken.mockResolvedValue({
        uid: "user-race",
        role: "participant",
        teamId: "team-1",
      });

      // First read: event is in voting_p1
      // But by the time the transaction runs, status may have changed
      // The vote route checks status BEFORE the transaction, so simulate
      // the status being "closed_p1" at read time
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          status: "closed_p1", // changed from voting_p1 to closed_p1
        }),
      });

      mockDoc.mockReturnValue({
        id: "doc-id",
        get: mockDocGet,
      });

      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer token-race" },
        body: { selectedTeams: ["team-2"] },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("투표 기간");
    });

    it("handles Firestore transaction contention gracefully", async () => {
      const POST = await getVoteHandler();

      mockVerifyIdToken.mockResolvedValue({
        uid: "user-contention",
        role: "participant",
        teamId: "team-1",
      });

      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          status: "voting_p1",
          maxVotesP1: 3,
        }),
      });

      mockDoc.mockReturnValue({
        id: "doc-id",
        get: mockDocGet,
      });

      mockGetAll.mockResolvedValue([
        { exists: true, id: "team-2", data: () => ({ isHidden: false }) },
      ]);

      // Simulate Firestore transaction contention error
      mockRunTransaction.mockRejectedValue(
        new Error("Transaction contention: too many retries")
      );

      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer token-contention" },
        body: { selectedTeams: ["team-2"] },
      });

      const res = await POST(req);
      // Should return 500 for unexpected transaction failures
      expect(res.status).toBe(500);
    });

    it("rejects vote submitted after status transitions from voting to waiting", async () => {
      const POST = await getVoteHandler();

      mockVerifyIdToken.mockResolvedValue({
        uid: "user-late",
        role: "participant",
        teamId: "team-1",
      });

      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          status: "waiting", // event went back to waiting
        }),
      });

      mockDoc.mockReturnValue({
        id: "doc-id",
        get: mockDocGet,
      });

      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer token-late" },
        body: { selectedTeams: ["team-2"] },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("투표 기간");
    });
  });

  // =========================================================================
  // 4. Phase-specific duplicate vote check
  // =========================================================================
  describe("Phase-specific duplicate prevention", () => {
    it("user who voted in P1 can still vote in P2 (different phase)", async () => {
      const POST = await getVoteHandler();

      mockVerifyIdToken.mockResolvedValue({
        uid: "judge-1",
        role: "judge",
        teamId: null,
      });

      // Event is in voting_p2
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          status: "voting_p2",
          maxVotesP2: 3,
          phase1SelectedTeamIds: ["team-2", "team-3"],
        }),
      });

      mockDoc.mockReturnValue({
        id: "doc-id",
        get: mockDocGet,
      });

      mockGetAll.mockResolvedValue([
        { exists: true, id: "team-2", data: () => ({ isHidden: false }) },
      ]);

      // Transaction: user has voted in P1 but not P2
      mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              hasVotedP1: true,  // already voted in P1
              hasVotedP2: false, // not yet voted in P2
            }),
          }),
          set: vi.fn(),
          update: vi.fn(),
        };
        await fn(tx);
      });

      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer judge-token" },
        body: { selectedTeams: ["team-2"] },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });
});
