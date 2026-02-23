import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock firebase-admin modules BEFORE importing route handlers
// ---------------------------------------------------------------------------

const mockVerifyIdToken = vi.fn();
const mockCreateCustomToken = vi.fn();

const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDocUpdate = vi.fn();
const mockDocDelete = vi.fn();
const mockGetAll = vi.fn();
const mockRunTransaction = vi.fn();
const mockCollectionDoc = vi.fn();
const mockCollectionGet = vi.fn();
const mockCollectionWhere = vi.fn();

// Build a chainable Firestore mock
function makeDocRef(id = "doc-id") {
  return {
    id,
    get: mockDocGet,
    set: mockDocSet,
    update: mockDocUpdate,
    delete: mockDocDelete,
    collection: () => ({
      doc: mockCollectionDoc.mockReturnValue(makeDocRef()),
      get: mockCollectionGet,
      where: mockCollectionWhere.mockReturnValue({ get: mockCollectionGet }),
    }),
  };
}

const mockDoc = vi.fn().mockImplementation((_path?: string) => makeDocRef());
const mockCollection = vi.fn().mockImplementation(() => ({
  doc: mockDoc,
  get: mockCollectionGet,
  where: mockCollectionWhere.mockReturnValue({ get: mockCollectionGet }),
}));

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
    createCustomToken: (...args: unknown[]) => mockCreateCustomToken(...args),
  },
  adminDb: {
    doc: (...args: unknown[]) => mockDoc(...args),
    collection: (...args: unknown[]) => mockCollection(...args),
    getAll: (...args: unknown[]) => mockGetAll(...args),
    runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
    batch: () => ({
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("@/lib/constants", () => ({
  EVENT_ID: "test-event",
  generateUniqueCode: (prefix: string, idx: number) => `${prefix}-${idx}`,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
) {
  const { method = "POST", headers = {}, body } = options;
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function nextReq(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
) {
  // NextRequest is essentially a Request in the test environment
  return buildRequest(url, options) as unknown as import("next/server").NextRequest;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Vote API Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Dynamically import route handlers after mocks are set up
  async function getVoteHandler() {
    const mod = await import("@/app/api/vote/route");
    return mod.POST;
  }

  async function getAuthHandler() {
    const mod = await import("@/app/api/auth/route");
    return mod.POST;
  }

  async function getAdminHandler() {
    const mod = await import("@/app/api/admin/route");
    return mod.POST;
  }

  // =========================================================================
  // 1. Auth bypass tests
  // =========================================================================
  describe("Auth bypass prevention", () => {
    it("rejects request with no Authorization header", async () => {
      const POST = await getVoteHandler();
      const req = nextReq("http://localhost/api/vote", {
        body: { selectedTeams: ["team1"] },
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it("rejects request with invalid Authorization format (no Bearer)", async () => {
      const POST = await getVoteHandler();
      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Basic abc123" },
        body: { selectedTeams: ["team1"] },
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("rejects request with expired/invalid token", async () => {
      mockVerifyIdToken.mockRejectedValue(new Error("Token expired"));

      const POST = await getVoteHandler();
      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer expired-token" },
        body: { selectedTeams: ["team1"] },
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });
  });

  // =========================================================================
  // 2. Privilege escalation: participant calling admin API
  // =========================================================================
  describe("Privilege escalation prevention", () => {
    it("rejects participant token on admin endpoint", async () => {
      // verifyIdToken returns participant role
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-1",
        role: "participant",
        teamId: "team-1",
      });

      const POST = await getAdminHandler();
      const req = nextReq("http://localhost/api/admin", {
        headers: { Authorization: "Bearer participant-token" },
        body: { action: "updateEventStatus", data: { status: "voting_p1" } },
      });

      const res = await POST(req);
      // Admin route returns 401 for non-admin
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("rejects judge token on admin endpoint", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "judge-1",
        role: "judge",
        teamId: null,
      });

      const POST = await getAdminHandler();
      const req = nextReq("http://localhost/api/admin", {
        headers: { Authorization: "Bearer judge-token" },
        body: { action: "resetVotes", data: {} },
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // 3. Phase/role enforcement
  // =========================================================================
  describe("Phase/role enforcement", () => {
    it("rejects participant voting in P2 (judge phase)", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-1",
        role: "participant",
        teamId: "team-1",
      });

      // Event is in voting_p2 phase
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          status: "voting_p2",
          maxVotesP2: 3,
          phase1SelectedTeamIds: ["team-2", "team-3"],
        }),
      });

      const POST = await getVoteHandler();
      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer valid-token" },
        body: { selectedTeams: ["team-2"] },
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("심사위원");
    });

    it("rejects judge voting in P1 (participant phase)", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "judge-1",
        role: "judge",
        teamId: null,
      });

      // Event is in voting_p1 phase
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          status: "voting_p1",
          maxVotesP1: 3,
        }),
      });

      const POST = await getVoteHandler();
      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer valid-token" },
        body: { selectedTeams: ["team-2"] },
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("참가자");
    });

    it("rejects voting when event status is not voting", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-1",
        role: "participant",
        teamId: "team-1",
      });

      // Event is in "waiting" status
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ status: "waiting" }),
      });

      const POST = await getVoteHandler();
      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer valid-token" },
        body: { selectedTeams: ["team-2"] },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("투표 기간");
    });
  });

  // =========================================================================
  // 4. Self-team voting block
  // =========================================================================
  describe("Self-team voting block", () => {
    it("rejects user voting for their own team", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-1",
        role: "participant",
        teamId: "team-1",
      });

      // Event is in voting_p1
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          status: "voting_p1",
          maxVotesP1: 3,
        }),
      });

      const POST = await getVoteHandler();
      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer valid-token" },
        body: { selectedTeams: ["team-1"] }, // own team!
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("자신의 팀");
    });
  });

  // =========================================================================
  // 5. Dedup of selectedTeams
  // =========================================================================
  describe("Deduplication of selectedTeams", () => {
    it("deduplicates team IDs before processing", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-1",
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

      // All teams exist and are not hidden
      mockGetAll.mockResolvedValue([
        { exists: true, id: "team-2", data: () => ({ isHidden: false }) },
      ]);

      // Transaction succeeds
      mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
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

      const POST = await getVoteHandler();
      // Send duplicated team IDs
      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer valid-token" },
        body: { selectedTeams: ["team-2", "team-2", "team-2"] },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      // getAll should have been called with only 1 team ref (deduplicated)
      expect(mockGetAll).toHaveBeenCalledTimes(1);
      const getallArgs = mockGetAll.mock.calls[0];
      expect(getallArgs).toHaveLength(1); // only 1 unique team
    });
  });

  // =========================================================================
  // 6. Hidden team voting block
  // =========================================================================
  describe("Hidden team voting block", () => {
    it("rejects voting for hidden team", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-1",
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

      // Team exists but is hidden
      mockGetAll.mockResolvedValue([
        { exists: true, id: "team-hidden", data: () => ({ isHidden: true }) },
      ]);

      const POST = await getVoteHandler();
      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer valid-token" },
        body: { selectedTeams: ["team-hidden"] },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("숨겨진 팀");
    });
  });

  // =========================================================================
  // 7. Non-existent team voting block
  // =========================================================================
  describe("Non-existent team voting block", () => {
    it("rejects voting for non-existent team", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-1",
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

      // Team does not exist
      mockGetAll.mockResolvedValue([
        { exists: false, id: "nonexistent-team" },
      ]);

      const POST = await getVoteHandler();
      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer valid-token" },
        body: { selectedTeams: ["nonexistent-team"] },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("팀을 찾을 수 없습니다");
    });
  });

  // =========================================================================
  // 8. Auth API tests
  // =========================================================================
  describe("Auth API", () => {
    it("rejects empty code", async () => {
      const POST = await getAuthHandler();
      const req = nextReq("http://localhost/api/auth", {
        body: { code: "" },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects non-string code", async () => {
      const POST = await getAuthHandler();
      const req = nextReq("http://localhost/api/auth", {
        body: { code: 12345 },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects invalid (non-existent) code", async () => {
      // Firestore doc doesn't exist
      mockDocGet.mockResolvedValue({ exists: false });

      const POST = await getAuthHandler();
      const req = nextReq("http://localhost/api/auth", {
        body: { code: "INVALID-CODE" },
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("유효하지 않은 코드");
    });
  });

  // =========================================================================
  // 9. Voting with empty selectedTeams
  // =========================================================================
  describe("Empty selectedTeams validation", () => {
    it("rejects empty selectedTeams array", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-1",
        role: "participant",
        teamId: "team-1",
      });

      const POST = await getVoteHandler();
      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer valid-token" },
        body: { selectedTeams: [] },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects non-array selectedTeams", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-1",
        role: "participant",
        teamId: "team-1",
      });

      const POST = await getVoteHandler();
      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer valid-token" },
        body: { selectedTeams: "team-2" },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // 10. Max votes enforcement
  // =========================================================================
  describe("Max votes enforcement", () => {
    it("rejects voting for more teams than allowed", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-1",
        role: "participant",
        teamId: "team-1",
      });

      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          status: "voting_p1",
          maxVotesP1: 2,
        }),
      });

      const POST = await getVoteHandler();
      const req = nextReq("http://localhost/api/vote", {
        headers: { Authorization: "Bearer valid-token" },
        body: { selectedTeams: ["team-2", "team-3", "team-4"] },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("최대");
    });
  });
});
