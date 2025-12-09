import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mocks
const mockToggle = vi.fn();
const mockIsExpanded = vi.fn();
const mockFetchEnrollmentsLazy = vi.fn();
const mockNavigateAddChild = vi.fn();
const mockGenerateReport = vi.fn();
const mockWithdraw = vi.fn();
const mockToastError = vi.fn();

interface StateShape {
  children: { id: number; name: string }[];
  loadingChildren: boolean;
  errorChildren?: string | null;
  expandedChildIds: number[];
  loadingChildEnrollments: number[];
  enrollmentsByChild: Record<number, { activityId: number; activityName: string }[]>;
  loadingReport?: boolean;
  reportError?: string | null;
}

const makeState = (overrides: Partial<StateShape> = {}): StateShape => ({
  children: [],
  loadingChildren: false,
  errorChildren: null,
  expandedChildIds: [],
  loadingChildEnrollments: [],
  enrollmentsByChild: {},
  loadingReport: false,
  reportError: null,
  ...overrides,
});

let currentState: StateShape = makeState();

beforeEach(() => {
  mockToggle.mockReset();
  mockIsExpanded.mockReset();
  mockFetchEnrollmentsLazy.mockReset();
  mockNavigateAddChild.mockReset();
  mockGenerateReport.mockReset();
  mockWithdraw.mockReset();
  mockToastError.mockReset();
  currentState = makeState();
});

// Stub UI children to isolate ParentDashboardPage wiring
// Note: Vitest hoists vi.mock calls, so module IDs must be string literals.
vi.mock("src/components/dashboard/actions/ActionsBar.tsx", () => ({
  ActionsBar: ({
    onAddChild,
    onGenerateReport,
    disabledReport,
    loadingReport,
  }: {
    onAddChild: () => void;
    onGenerateReport: () => void;
    disabledReport: boolean;
    loadingReport: boolean;
  }) => (
    <div data-testid="actions-bar">
      <button onClick={onAddChild}>add-child</button>
      <button onClick={onGenerateReport}>generate-report</button>
      <span>disabled:{String(disabledReport)}</span>
      <span>loading:{String(loadingReport)}</span>
    </div>
  ),
}));

vi.mock("src/components/dashboard/ChildrenAccordion.tsx", () => ({
  ChildrenAccordion: ({
    onExpand,
    onWithdraw,
  }: {
    onExpand: (id: number) => void;
    onWithdraw: (args: { childId: number; activityId: number }) => void;
  }) => (
    <div data-testid="children-accordion">
      <button onClick={() => onExpand(1)}>expand-1</button>
      <button onClick={() => onWithdraw({ childId: 7, activityId: 9 })}>withdraw-7-9</button>
    </div>
  ),
}));

vi.mock("src/components/dashboard/EmptyChildrenState.tsx", () => ({
  EmptyChildrenState: ({ onAddChild }: { onAddChild: () => void }) => (
    <div data-testid="empty-children">
      <button onClick={onAddChild}>add-child</button>
    </div>
  ),
}));

vi.mock("src/components/dashboard/LoadingSpinner.tsx", () => ({
  LoadingSpinner: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock("src/components/ui/useToastFeedback.ts", () => ({
  useToastFeedback: () => ({ error: mockToastError }),
}));

vi.mock("src/components/hooks/parentDashboard/useParentDashboard.ts", () => ({
  useParentDashboard: () => ({
    state: currentState,
    toggleChildExpansion: mockToggle,
    isChildExpanded: mockIsExpanded,
    fetchEnrollmentsLazy: mockFetchEnrollmentsLazy,
    navigateAddChild: mockNavigateAddChild,
    generateReport: mockGenerateReport,
    withdraw: mockWithdraw,
  }),
}));

// Import component under test AFTER mocks
import ParentDashboardPage from "src/components/dashboard/ParentDashboardPage";

describe("ParentDashboardPage", () => {
  it("renders LoadingSpinner when loading children", () => {
    currentState = makeState({ loadingChildren: true });
    render(<ParentDashboardPage />);
    expect(screen.getByText("Ładowanie dzieci...")).toBeInTheDocument();
  });

  it("renders EmptyChildrenState when no children and not loading", () => {
    currentState = makeState({ loadingChildren: false, children: [] });
    render(<ParentDashboardPage />);
    const empty = screen.getByTestId("empty-children");
    expect(empty).toBeInTheDocument();
  });

  it("renders main view with ActionsBar and ChildrenAccordion when children exist", () => {
    currentState = makeState({
      children: [{ id: 1, name: "Kid" }],
      loadingChildren: false,
      loadingReport: true,
    });
    render(<ParentDashboardPage />);
    expect(screen.getByTestId("actions-bar")).toBeInTheDocument();
    expect(screen.getByTestId("children-accordion")).toBeInTheDocument();
    expect(screen.getByText("disabled:true")).toBeInTheDocument();
    expect(screen.getByText("loading:true")).toBeInTheDocument();
  });

  it("wires ActionsBar handlers correctly", async () => {
    currentState = makeState({
      children: [
        {
          id: 1,
          name: "Child 1",
        },
      ],
      loadingChildren: false,
    });
    render(<ParentDashboardPage />);
    await screen.findByTestId("actions-bar");
    screen.getByText("add-child").click();
    screen.getByText("generate-report").click();
    expect(mockNavigateAddChild).toHaveBeenCalledTimes(1);
    expect(mockGenerateReport).toHaveBeenCalledTimes(1);
  });

  it("handles expand: toggles and fetches when not already expanded", () => {
    currentState = makeState({ children: [{ id: 1, name: "Child 1" }], loadingChildren: false });
    mockIsExpanded.mockReturnValue(false);
    render(<ParentDashboardPage />);
    screen.getByText("expand-1").click();
    expect(mockToggle).toHaveBeenCalledWith(1);
    expect(mockFetchEnrollmentsLazy).toHaveBeenCalledWith(1);
  });

  it("handles withdraw forwarding childId/activityId", () => {
    currentState = makeState({ children: [{ id: 1, name: "Child 1" }], loadingChildren: false });
    render(<ParentDashboardPage />);
    screen.getByText("withdraw-7-9").click();
    expect(mockWithdraw).toHaveBeenCalledWith(7, 9);
  });

  it("shows aria-live dashboard status messages", () => {
    currentState = makeState({
      children: [{ id: 1, name: "Child 1" }],
      loadingChildren: false,
      errorChildren: "Błąd dzieci",
      reportError: "Błąd raportu",
      loadingReport: true,
    });
    render(<ParentDashboardPage />);
    const live = screen.getByRole("region", { name: "Panel rodzica" });
    expect(live).toBeInTheDocument();
    expect(screen.getByText(/Błąd: Błąd dzieci/)).toBeInTheDocument();
    expect(screen.getByText(/Błąd raportu: Błąd raportu/)).toBeInTheDocument();
    expect(screen.getByText(/Generowanie raportu/)).toBeInTheDocument();
  });

  it("triggers toast error effect when errorChildren set", () => {
    currentState = makeState({ children: [{ id: 1, name: "Child 1" }], loadingChildren: false, errorChildren: "err" });
    render(<ParentDashboardPage />);
    expect(mockToastError).toHaveBeenCalledWith("err");
  });
});
