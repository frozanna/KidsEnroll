/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@/db/supabase.client";
import { createEnrollment } from "@/lib/services/enrollments.service";
import { createError } from "@/lib/services/errors";
import type { CreateEnrollmentCommand } from "@/types";

vi.mock("@/lib/services/errors", () => ({
  createError: vi.fn((code: string, message: string, meta?: unknown) => {
    const error: any = new Error(message);
    error.code = code;
    if (meta) error.meta = meta;
    return error;
  }),
}));

type MockSupabase = Pick<SupabaseClient, "from"> & {
  __mocks: {
    childrenSelect: ReturnType<typeof vi.fn>;
    activitiesSelect: ReturnType<typeof vi.fn>;
    enrollmentsSelect: ReturnType<typeof vi.fn>;
    enrollmentsInsert: ReturnType<typeof vi.fn>;
  };
};

const makeSupabaseMock = (): MockSupabase => {
  const childrenSelect = vi.fn();
  const activitiesSelect = vi.fn();
  const enrollmentsSelect = vi.fn();
  const enrollmentsInsert = vi.fn();

  const from = vi.fn((table: string): any => {
    switch (table) {
      case "children":
        return { select: childrenSelect };
      case "activities":
        return { select: activitiesSelect };
      case "enrollments":
        return {
          select: enrollmentsSelect,
          insert: enrollmentsInsert,
        };
      default:
        throw new Error(`Unexpected table ${table}`);
    }
  });

  return {
    from,
    __mocks: { childrenSelect, activitiesSelect, enrollmentsSelect, enrollmentsInsert },
  } as unknown as MockSupabase;
};

const parentId = "parent-1";
const baseCommand: CreateEnrollmentCommand = { child_id: 1, activity_id: 10 };

describe("createEnrollment", () => {
  let supabase: MockSupabase;

  beforeEach(() => {
    supabase = makeSupabaseMock();
    (createError as unknown as ReturnType<typeof vi.fn>).mockClear?.();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const setupChildOwned = () => {
    supabase.__mocks.childrenSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 1, first_name: "Kid", last_name: "One", parent_id: parentId },
        error: null,
      }),
    });
  };

  const setupActivityValid = () => {
    supabase.__mocks.activitiesSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 10,
          name: "Swimming",
          cost: 100,
          participant_limit: 5,
          start_datetime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      }),
    });
  };

  const setupNoCapacityIssues = () => {
    supabase.__mocks.enrollmentsSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ count: 1, error: null }),
    });

    supabase.__mocks.enrollmentsSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnThis().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    supabase.__mocks.enrollmentsInsert.mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { child_id: 1, activity_id: 10, enrolled_at: "2025-01-01T00:00:00.000Z" },
        error: null,
      }),
    });
  };

  it("creates enrollment when all business rules pass", async () => {
    setupChildOwned();
    setupActivityValid();
    setupNoCapacityIssues();

    const result = await createEnrollment(supabase as unknown as SupabaseClient, parentId, baseCommand);

    expect(result).toEqual({
      child_id: 1,
      activity_id: 10,
      enrolled_at: "2025-01-01T00:00:00.000Z",
      activity: expect.objectContaining({
        name: "Swimming",
        cost: 100,
      }),
      child: {
        first_name: "Kid",
        last_name: "One",
      },
    });
  });

  it("throws CHILD_NOT_FOUND when child does not exist", async () => {
    supabase.__mocks.childrenSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnThis().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    // Second query: any child
    supabase.__mocks.childrenSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(createEnrollment(supabase as unknown as SupabaseClient, parentId, baseCommand)).rejects.toMatchObject({
      code: "CHILD_NOT_FOUND",
    });
  });

  it("throws CHILD_NOT_OWNED when child belongs to different parent", async () => {
    supabase.__mocks.childrenSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnThis().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    supabase.__mocks.childrenSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 1, first_name: "Kid", last_name: "One", parent_id: "other-parent" },
        error: null,
      }),
    });

    await expect(createEnrollment(supabase as unknown as SupabaseClient, parentId, baseCommand)).rejects.toMatchObject({
      code: "CHILD_NOT_OWNED",
    });
  });

  it("throws ACTIVITY_NOT_FOUND when activity does not exist", async () => {
    setupChildOwned();

    supabase.__mocks.activitiesSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(createEnrollment(supabase as unknown as SupabaseClient, parentId, baseCommand)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
    });
  });

  it("throws ACTIVITY_STARTED when activity already started", async () => {
    setupChildOwned();

    supabase.__mocks.activitiesSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 10,
          name: "Swimming",
          cost: 100,
          participant_limit: 5,
          start_datetime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
        error: null,
      }),
    });

    await expect(createEnrollment(supabase as unknown as SupabaseClient, parentId, baseCommand)).rejects.toMatchObject({
      code: "ACTIVITY_STARTED",
    });
  });

  it("throws ACTIVITY_FULL when participant_limit reached", async () => {
    setupChildOwned();
    setupActivityValid();

    (supabase.from as unknown as vi.Mock).mockImplementation((table: string) => {
      if (table === "children") {
        return { select: supabase.__mocks.childrenSelect };
      }
      if (table === "activities") {
        return { select: supabase.__mocks.activitiesSelect };
      }
      if (table === "enrollments") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 5,
              error: null,
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(createEnrollment(supabase as unknown as SupabaseClient, parentId, baseCommand)).rejects.toMatchObject({
      code: "ACTIVITY_FULL",
    });
  });

  it("throws ENROLLMENT_DUPLICATE when child already enrolled", async () => {
    setupChildOwned();
    setupActivityValid();

    supabase.__mocks.enrollmentsSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ count: 1, error: null }),
    });

    supabase.__mocks.enrollmentsSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnThis().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { child_id: 1 }, error: null }),
    });

    await expect(createEnrollment(supabase as unknown as SupabaseClient, parentId, baseCommand)).rejects.toMatchObject({
      code: "ENROLLMENT_DUPLICATE",
    });
  });
});
