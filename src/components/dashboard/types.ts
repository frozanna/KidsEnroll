// ViewModel types for Parent Dashboard (frontend-specific abstractions over API DTOs)
// Keep transformations pure and colocated in hooks for testability.

export interface ChildViewModel {
  id: number;
  fullName: string;
  age: string; // Derived from birth_date (human readable: e.g., "5 lat")
  description?: string | null;
}

export interface EnrollmentViewModel {
  childId: number;
  activityId: number;
  activityName: string;
  workerFullName: string;
  startLocalDate: string; // YYYY-MM-DD (local)
  startLocalTime: string; // HH:mm (local)
  cost: number;
  canWithdraw: boolean;
  description?: string | null; // activity description
}

export interface DashboardState {
  children: ChildViewModel[];
  expandedChildIds: number[];
  enrollmentsByChild: Record<number, EnrollmentViewModel[]>;
  loadingChildren: boolean;
  loadingChildEnrollments: number[]; // childIds currently fetching
  errorChildren?: string;
  errorEnrollments?: Record<number, string>; // per-child errors
  loadingReport: boolean;
  reportError?: string;
}
