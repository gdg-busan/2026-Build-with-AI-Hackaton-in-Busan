import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

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
const mockCollectionAdd = vi.fn();

// Build a chainable Firestore mock
function makeDocRef(id = "doc-id") {
  return {
    id,
    get: mockDocGet,
    set: mockDocSet,
    update: mockDocUpdate,
    delete: mockDocDelete,
    collection: (name: string) => ({
      doc: mockCollectionDoc.mockReturnValue(makeDocRef()),
      get: mockCollectionGet,
      where: mockCollectionWhere.mockReturnValue({
        get: mockCollectionGet,
        limit: () => ({ get: mockCollectionGet }),
      }),
      add: mockCollectionAdd,
    }),
  };
}

const mockDoc = vi.fn().mockImplementation((_path?: string) => makeDocRef());
const mockCollection = vi.fn().mockImplementation(() => ({
  doc: mockCollectionDoc.mockReturnValue(makeDocRef()),
  get: mockCollectionGet,
  where: mockCollectionWhere.mockReturnValue({
    get: mockCollectionGet,
    limit: () => ({ get: mockCollectionGet }),
  }),
  add: mockCollectionAdd,
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

vi.mock("@/shared/api/firebase-admin", () => ({
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

vi.mock("@/shared/config/constants", () => ({
  EVENT_ID: "test-event",
  generateUniqueCode: (prefix: string, idx: number) => `${prefix}-${idx}`,
  TEAM_EMOJIS: ["🎯"],
}));

vi.mock("@/features/mission/api/mission-tracker", () => ({
  checkProfileComplete: vi.fn().mockResolvedValue(undefined),
  trackMission: vi.fn().mockResolvedValue(undefined),
  trackUniqueMission: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/voting/lib/scoring", () => ({
  getPhase1Results: vi.fn().mockReturnValue({
    selectedTeamIds: [],
    tiedTeams: null,
    tiedGroups: [],
    hasTiedGroups: false,
  }),
  calculateFinalScores: vi.fn().mockReturnValue([]),
  detectFinalTies: vi.fn().mockReturnValue({ tiedTeams: [] }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextReq(
  url = "http://localhost/test",
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
  }) as unknown as import("next/server").NextRequest;
}

function mockAuth(overrides: { uid?: string; role?: string; teamId?: string | null; name?: string } = {}) {
  mockVerifyIdToken.mockResolvedValue({
    uid: "user-1",
    role: "participant",
    ...overrides,
  });
}

function mockAdmin() {
  mockAuth({ uid: "admin-1", role: "admin" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Auth Route Handler", () => {
  let POST: Awaited<typeof import("@app/api/auth/route")>["POST"];
  beforeAll(async () => { POST = (await import("@app/api/auth/route")).POST; });
  beforeEach(() => vi.clearAllMocks());

  it("returns token for valid code", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ name: "참가자 1", role: "participant", teamId: "team-1" }),
    });
    mockCreateCustomToken.mockResolvedValue("custom-token-123");

    const res = await POST(nextReq(undefined, { body: { code: "p-001" } }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBe("custom-token-123");
  });

  it("normalizes code (trim + uppercase)", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ name: "참가자 1", role: "participant", teamId: null }),
    });
    mockCreateCustomToken.mockResolvedValue("token");

    await POST(nextReq(undefined, { body: { code: "  abc-123  " } }));

    expect(mockCollectionDoc).toHaveBeenCalledWith("ABC-123");
  });

  it("rejects empty code with 400", async () => {
    const res = await POST(nextReq(undefined, { body: { code: "" } }));
    expect(res.status).toBe(400);
  });

  it("rejects non-existent code with 401", async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    const res = await POST(nextReq(undefined, { body: { code: "INVALID" } }));

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("유효하지 않은 코드");
  });
});

describe("Vote Happy Path", () => {
  let POST: Awaited<typeof import("@app/api/vote/route")>["POST"];
  beforeAll(async () => { POST = (await import("@app/api/vote/route")).POST; });
  beforeEach(() => vi.clearAllMocks());

  it("participant votes successfully in P1", async () => {
    mockAuth({ teamId: "team-1" });

    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "voting_p1", maxVotesP1: 3 }),
    });

    mockGetAll.mockResolvedValue([
      { exists: true, id: "team-2", data: () => ({ isHidden: false }) },
    ]);

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

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer valid-token" },
        body: { selectedTeams: ["team-2"] },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("judge votes successfully in P2", async () => {
    mockAuth({ uid: "judge-1", role: "judge", teamId: null });

    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        status: "voting_p2",
        maxVotesP2: 3,
        phase1SelectedTeamIds: ["team-2", "team-3"],
      }),
    });

    mockGetAll.mockResolvedValue([
      { exists: true, id: "team-2", data: () => ({ isHidden: false }) },
    ]);

    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ hasVotedP2: false }),
        }),
        set: vi.fn(),
        update: vi.fn(),
      };
      await fn(tx);
    });

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer valid-token" },
        body: { selectedTeams: ["team-2"] },
      })
    );

    expect(res.status).toBe(200);
  });

  it("rejects duplicate vote with 409", async () => {
    mockAuth({ teamId: "team-1" });

    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "voting_p1", maxVotesP1: 3 }),
    });

    mockGetAll.mockResolvedValue([
      { exists: true, id: "team-2", data: () => ({ isHidden: false }) },
    ]);

    mockRunTransaction.mockImplementation(async () => {
      throw new Error("ALREADY_VOTED");
    });

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer valid-token" },
        body: { selectedTeams: ["team-2"] },
      })
    );

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("이미 투표");
  });

  it("rejects P2 vote for non-phase1 team", async () => {
    mockAuth({ uid: "judge-1", role: "judge", teamId: null });

    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        status: "voting_p2",
        maxVotesP2: 3,
        phase1SelectedTeamIds: ["team-2", "team-3"],
      }),
    });

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer valid-token" },
        body: { selectedTeams: ["team-99"] },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("1차 투표에서 선정된 팀");
  });
});

describe("Admin Status Transitions", () => {
  let POST: Awaited<typeof import("@app/api/admin/route")>["POST"];
  beforeAll(async () => { POST = (await import("@app/api/admin/route")).POST; });
  beforeEach(() => vi.clearAllMocks());

  it("allows +1 step transition (waiting → voting_p1)", async () => {
    mockAdmin();
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "waiting" }),
    });
    mockDocUpdate.mockResolvedValue(undefined);

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer admin-token" },
        body: { action: "updateEventStatus", data: { status: "voting_p1" } },
      })
    );

    expect(res.status).toBe(200);
  });

  it("blocks skipping phases (waiting → closed_p1)", async () => {
    mockAdmin();
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "waiting" }),
    });

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer admin-token" },
        body: { action: "updateEventStatus", data: { status: "closed_p1" } },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Cannot skip phases");
  });

  it("blocks revealed_final with unresolved ties", async () => {
    mockAdmin();
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        status: "closed_p2",
        phase1SelectedTeamIds: ["t1", "t2"],
        judgeWeight: 0.8,
        participantWeight: 0.2,
        finalRankingOverrides: null,
      }),
    });
    mockCollectionGet.mockResolvedValue({ docs: [] });

    const { detectFinalTies } = await import("@/features/voting/lib/scoring");
    (detectFinalTies as ReturnType<typeof vi.fn>).mockReturnValue({
      tiedTeams: [
        { teamId: "t1", teamName: "Team 1", emoji: "🎯", finalScore: 50 },
        { teamId: "t2", teamName: "Team 2", emoji: "🎯", finalScore: 50 },
      ],
    });

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer admin-token" },
        body: { action: "updateEventStatus", data: { status: "revealed_final" } },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("동점");
  });
});

describe("Admin Cascade Operations", () => {
  let POST: Awaited<typeof import("@app/api/admin/route")>["POST"];
  beforeAll(async () => { POST = (await import("@app/api/admin/route")).POST; });
  beforeEach(() => vi.clearAllMocks());

  it("deleteTeam clears user teamId references", async () => {
    mockAdmin();
    mockDocDelete.mockResolvedValue(undefined);
    mockCollectionGet.mockResolvedValue({
      empty: false,
      docs: [
        { ref: { id: "user-1" }, data: () => ({ teamId: "team-1" }) },
      ],
    });

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer admin-token" },
        body: { action: "deleteTeam", data: { teamId: "team-1" } },
      })
    );

    expect(res.status).toBe(200);
    expect(mockDocDelete).toHaveBeenCalled();
  });

  it("deleteUser removes from team and deletes votes", async () => {
    mockAdmin();
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ teamId: "team-1", role: "participant" }),
    });
    mockCollectionGet.mockResolvedValue({
      empty: true,
      docs: [],
    });

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer admin-token" },
        body: { action: "deleteUser", data: { userCode: "P-001" } },
      })
    );

    expect(res.status).toBe(200);
  });

  it("resetVotes resets all vote data", async () => {
    mockAdmin();
    mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });
    mockDocUpdate.mockResolvedValue(undefined);

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer admin-token" },
        body: { action: "resetVotes", data: {} },
      })
    );

    expect(res.status).toBe(200);
  });
});

describe("User Profile Validation", () => {
  let PUT: Awaited<typeof import("@app/api/user/route")>["PUT"];
  beforeAll(async () => { PUT = (await import("@app/api/user/route")).PUT; });
  beforeEach(() => vi.clearAllMocks());

  it("rejects admin role", async () => {
    mockAdmin();

    const res = await PUT(
      nextReq(undefined, {
        method: "PUT",
        headers: { Authorization: "Bearer admin-token" },
        body: { name: "Test" },
      })
    );

    expect(res.status).toBe(403);
  });

  it("rejects name exceeding 20 chars", async () => {
    mockAuth();

    const res = await PUT(
      nextReq(undefined, {
        method: "PUT",
        headers: { Authorization: "Bearer token" },
        body: { name: "A".repeat(21) },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("20자");
  });

  it("rejects bio exceeding 100 chars", async () => {
    mockAuth();

    const res = await PUT(
      nextReq(undefined, {
        method: "PUT",
        headers: { Authorization: "Bearer token" },
        body: { bio: "A".repeat(101) },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("100자");
  });

  it("succeeds with valid update", async () => {
    mockAuth();
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({}) });
    mockDocUpdate.mockResolvedValue(undefined);

    const res = await PUT(
      nextReq(undefined, {
        method: "PUT",
        headers: { Authorization: "Bearer token" },
        body: { name: "홍길동", bio: "개발자", techTags: ["React"] },
      })
    );

    expect(res.status).toBe(200);
  });
});

describe("Team Update Validation", () => {
  let PUT: Awaited<typeof import("@app/api/team/route")>["PUT"];
  beforeAll(async () => { PUT = (await import("@app/api/team/route")).PUT; });
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-member update", async () => {
    mockAuth({ uid: "user-999", teamId: "team-1" });
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ memberUserIds: ["user-1", "user-2"] }),
    });

    const res = await PUT(
      nextReq(undefined, {
        method: "PUT",
        headers: { Authorization: "Bearer token" },
        body: { nickname: "Cool Team" },
      })
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("멤버가 아닙니다");
  });

  it("rejects nickname exceeding 30 chars", async () => {
    mockAuth({ teamId: "team-1" });

    const res = await PUT(
      nextReq(undefined, {
        method: "PUT",
        headers: { Authorization: "Bearer token" },
        body: { nickname: "A".repeat(31) },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("30자");
  });

  it("rejects invalid URL (no http/https)", async () => {
    mockAuth({ teamId: "team-1" });

    const res = await PUT(
      nextReq(undefined, {
        method: "PUT",
        headers: { Authorization: "Bearer token" },
        body: { projectUrl: "ftp://example.com" },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("http://");
  });
});

describe("Cheer Rate Limiting", () => {
  let POST: Awaited<typeof import("@app/api/cheer/route")>["POST"];
  beforeAll(async () => { POST = (await import("@app/api/cheer/route")).POST; });
  beforeEach(() => vi.clearAllMocks());

  it("returns 429 when cheering within 3 seconds", async () => {
    mockAuth({ name: "Test" });
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        lastCheerAt: { toDate: () => new Date(Date.now() - 1000) },
      }),
    });

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer token" },
        body: { teamId: "team-1", emoji: "🔥" },
      })
    );

    expect(res.status).toBe(429);
  });

  it("rejects disallowed emoji with 400", async () => {
    mockAuth({ name: "Test" });
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ lastCheerAt: null }),
    });

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer token" },
        body: { teamId: "team-1", emoji: "💀" },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("허용되지 않은 이모지");
  });

  it("succeeds with valid cheer", async () => {
    mockAuth({ name: "Test" });
    mockDocGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ lastCheerAt: null }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ name: "Team 1" }),
      });

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer token" },
        body: { teamId: "team-1", emoji: "🔥" },
      })
    );

    expect(res.status).toBe(200);
  });
});

describe("Feedback Rate Limiting", () => {
  let POST: Awaited<typeof import("@app/api/feedback/route")>["POST"];
  beforeAll(async () => { POST = (await import("@app/api/feedback/route")).POST; });
  beforeEach(() => vi.clearAllMocks());

  it("returns 429 when sending feedback within 5 seconds", async () => {
    mockAuth({ teamId: "team-1" });
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        lastFeedbackAt: { toDate: () => new Date(Date.now() - 2000) },
      }),
    });

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer token" },
        body: { teamId: "team-2", text: "Great work!", type: "cheer", anonymous: false },
      })
    );

    expect(res.status).toBe(429);
  });

  it("rejects text exceeding 200 chars", async () => {
    mockAuth({ teamId: "team-1" });
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ lastFeedbackAt: null }),
    });

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer token" },
        body: { teamId: "team-2", text: "A".repeat(201), type: "cheer", anonymous: false },
      })
    );

    expect(res.status).toBe(400);
  });

  it("rejects invalid feedback type", async () => {
    mockAuth({ teamId: "team-1" });
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ lastFeedbackAt: null }),
    });

    const res = await POST(
      nextReq(undefined, {
        headers: { Authorization: "Bearer token" },
        body: { teamId: "team-2", text: "Hello", type: "invalid-type", anonymous: false },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("유효하지 않은 피드백 유형");
  });
});

describe("Lookup Route", () => {
  let POST: Awaited<typeof import("@app/api/lookup/route")>["POST"];
  beforeAll(async () => { POST = (await import("@app/api/lookup/route")).POST; });
  beforeEach(() => vi.clearAllMocks());

  it("rejects missing fields with 400", async () => {
    const res = await POST(
      nextReq(undefined, {
        body: { email: "test@example.com" },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("이름과 이메일");
  });

  it("returns 404 for non-existent email", async () => {
    mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });

    const res = await POST(
      nextReq(undefined, {
        body: { email: "nobody@example.com", name: "Unknown" },
      })
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 when name doesn't match", async () => {
    mockCollectionGet.mockResolvedValue({
      empty: false,
      docs: [{ id: "P-001", data: () => ({ name: "홍길동", email: "test@example.com" }) }],
    });

    const res = await POST(
      nextReq(undefined, {
        body: { email: "test@example.com", name: "김철수" },
      })
    );

    expect(res.status).toBe(404);
  });

  it("returns code for matching email + name", async () => {
    mockCollectionGet.mockResolvedValue({
      empty: false,
      docs: [{ id: "P-001", data: () => ({ name: "홍길동", email: "test@example.com" }) }],
    });

    const res = await POST(
      nextReq(undefined, {
        body: { email: "test@example.com", name: "홍길동" },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.code).toBe("P-001");
    expect(data.name).toBe("홍길동");
  });
});
