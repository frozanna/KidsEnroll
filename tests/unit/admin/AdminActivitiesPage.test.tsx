import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the hook before importing the component (vitest factory runs before imports)
vi.mock("@/components/hooks/adminDashboard/useAdminActivitiesList", () => {
  const baseState = {
    loadState: "loading" as const,
    data: [] as { id: number; name: string }[],
    filters: { search: "" },
    pagination: { page: 1, limit: 10, total: 0 },
    deleteDialog: { open: false, activityId: undefined as number | undefined },
    deleting: false,
    error: undefined as string | undefined,
  };

  // Mutable mock that tests can override per-case
  const mockStore: {
    state: typeof baseState;
    setSearch: ReturnType<typeof vi.fn>;
    goToPage: ReturnType<typeof vi.fn>;
    openDeleteDialog: ReturnType<typeof vi.fn>;
    closeDeleteDialog: ReturnType<typeof vi.fn>;
    confirmDelete: ReturnType<typeof vi.fn>;
    retry: ReturnType<typeof vi.fn>;
  } = {
    state: baseState,
    setSearch: vi.fn(),
    goToPage: vi.fn(),
    openDeleteDialog: vi.fn(),
    closeDeleteDialog: vi.fn(),
    confirmDelete: vi.fn(),
    retry: vi.fn(),
  };

  return {
    useAdminActivitiesList: () => mockStore,
    // Expose helpers for tests to mutate the store safely
    __mockStore: mockStore,
  };
});

// Import after mocks
import { AdminActivitiesPage } from "@/components/admin/activities/AdminActivitiesPage";
// Pull the exposed mock store so tests can adjust state/functions
// Import the module and access the mocked export via a safe cast
import * as HookModule from "@/components/hooks/adminDashboard/useAdminActivitiesList";
interface MockStoreType {
  state: {
    loadState: "loading" | "error" | "success";
    data: { id: number; name: string }[];
    filters: { search: string };
    pagination: { page: number; limit: number; total: number };
    deleteDialog: { open: boolean; activityId: number | undefined };
    deleting: boolean;
    error: string | undefined;
  };
  setSearch: jest.Mock;
  goToPage: jest.Mock;
  openDeleteDialog: jest.Mock;
  closeDeleteDialog: jest.Mock;
  confirmDelete: jest.Mock;
  retry: jest.Mock;
}

const __mockStore = (HookModule as unknown as { __mockStore: MockStoreType }).__mockStore;

describe("AdminActivitiesPage", () => {
  beforeEach(() => {
    // Reset store before each test
    __mockStore.state = {
      loadState: "loading",
      data: [],
      filters: { search: "" },
      pagination: { page: 1, limit: 10, total: 0 },
      deleteDialog: { open: false, activityId: undefined },
      deleting: false,
      error: undefined,
    };
    __mockStore.setSearch.mockReset();
    __mockStore.goToPage.mockReset();
    __mockStore.openDeleteDialog.mockReset();
    __mockStore.closeDeleteDialog.mockReset();
    __mockStore.confirmDelete.mockReset();
    __mockStore.retry.mockReset();
  });

  it("renders loading state", () => {
    __mockStore.state.loadState = "loading";
    render(<AdminActivitiesPage />);
    const main = screen.getAllByRole("main")[0];
    expect(main).toBeInTheDocument();
    expect(within(main).getByLabelText("Ładowanie")).toBeInTheDocument();
  });

  it("renders error state with actions", async () => {
    __mockStore.state = {
      ...__mockStore.state,
      loadState: "error",
      error: "Błąd pobierania danych",
    };
    const user = userEvent.setup();
    // stub global reload
    const reloadSpy = vi.fn();
    vi.stubGlobal("window", { location: { reload: reloadSpy } } as unknown as Window);

    render(<AdminActivitiesPage />);
    const main = screen.getAllByRole("main")[0];
    expect(within(main).getByText("Błąd pobierania danych")).toBeInTheDocument();
    const refreshBtn = within(main).getByRole("button", { name: "Odśwież stronę" });
    const retryBtn = within(main).getByRole("button", { name: "Spróbuj ponownie" });

    await user.click(refreshBtn);
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    await user.click(retryBtn);
    expect(__mockStore.retry).toHaveBeenCalledTimes(1);
  });

  it("renders success empty state (no data)", () => {
    __mockStore.state = {
      ...__mockStore.state,
      loadState: "success",
      data: [],
    };
    render(<AdminActivitiesPage />);
    const main = screen.getAllByRole("main")[0];
    // Expect the empty state status role to be present
    const statuses = within(main).getAllByRole("status");
    expect(statuses.length).toBeGreaterThan(0);
    // Table and pagination should not render
    expect(within(main).queryByTestId("admin-activities-table")).toBeNull();
    expect(within(main).queryByTestId("pagination-controls")).toBeNull();
  });

  it("renders success with data: table and pagination", () => {
    __mockStore.state = {
      ...__mockStore.state,
      loadState: "success",
      data: [{ id: 1, name: "Taniec" }],
      pagination: { page: 1, limit: 10, total: 15 },
    };
    render(<AdminActivitiesPage />);
    const main = screen.getAllByRole("main")[0];
    expect(within(main).getByTestId("admin-activities-table")).toBeInTheDocument();
    expect(within(main).getByTestId("pagination-controls")).toBeInTheDocument();
  });

  it("calls setSearch when toolbar search changes", async () => {
    __mockStore.state = {
      ...__mockStore.state,
      loadState: "success",
    };
    const user = userEvent.setup();
    render(<AdminActivitiesPage />);
    const main = screen.getAllByRole("main")[0];
    // The input has type="search" thus role is "searchbox"
    const searchInput = within(main).getByRole("searchbox");
    await user.clear(searchInput);
    await user.type(searchInput, "judo");
    // Depending on implementation, onChange may fire per keystroke
    expect(__mockStore.setSearch).toHaveBeenCalled();
    expect(__mockStore.setSearch.mock.calls.at(-1)?.[0]).toBe("judo");
  });

  it("invokes openDeleteDialog when delete clicked in table", async () => {
    __mockStore.state = {
      ...__mockStore.state,
      loadState: "success",
      data: [{ id: 7, name: "Szachy" }],
    };
    const user = userEvent.setup();
    render(<AdminActivitiesPage />);
    const main = screen.getAllByRole("main")[0];
    const table = within(main).getByTestId("admin-activities-table");
    const deleteBtn = within(table).getByRole("button", { name: /usuń/i });
    await user.click(deleteBtn);
    expect(__mockStore.openDeleteDialog).toHaveBeenCalledWith(7);
  });

  it("pagination triggers goToPage", async () => {
    __mockStore.state = {
      ...__mockStore.state,
      loadState: "success",
      data: [{ id: 1, name: "Taniec" }],
      pagination: { page: 1, limit: 10, total: 25 },
    };
    const user = userEvent.setup();
    render(<AdminActivitiesPage />);
    const main = screen.getAllByRole("main")[0];
    const nextBtn = within(main).getByRole("button", { name: /następna/i });
    await user.click(nextBtn);
    expect(__mockStore.goToPage).toHaveBeenCalled();
  });

  it("delete dialog props: open/cancel/confirm/submitting and activityName resolve", async () => {
    __mockStore.state = {
      ...__mockStore.state,
      loadState: "success",
      data: [
        { id: 3, name: "Plastyka" },
        { id: 4, name: "Robotyka" },
      ],
      deleteDialog: { open: true, activityId: 4 },
      deleting: true,
    };
    const user = userEvent.setup();
    render(<AdminActivitiesPage />);

    // Activity name should be visible in dialog content (target dialog scope)
    const dialog = screen.getAllByRole("dialog")[0];
    expect(within(dialog).getByText(/Robotyka/i)).toBeInTheDocument();

    // Buttons wired
    const cancelBtn = within(dialog).getByRole("button", { name: /anuluj/i });
    const confirmBtn = within(dialog).getByRole("button", { name: /potwierdź|usuń/i });

    await user.click(cancelBtn);
    await user.click(confirmBtn);
    expect(__mockStore.closeDeleteDialog).toHaveBeenCalled();
    expect(__mockStore.confirmDelete).toHaveBeenCalled();

    // Submitting flag typically disables confirm
    expect(confirmBtn).toBeDisabled();
  });

  it("deleteActivityName is undefined when no matching id", () => {
    __mockStore.state = {
      ...__mockStore.state,
      loadState: "success",
      data: [{ id: 1, name: "Muzyka" }],
      deleteDialog: { open: true, activityId: 999 },
    };
    render(<AdminActivitiesPage />);
    // Dialog should render but not show a concrete name (check inside dialog)
    const dialog = screen.getAllByRole("dialog")[0];
    expect(within(dialog).queryByText("Muzyka")).toBeNull();
  });
});
