import React from "react";
import type { EnrollmentViewModel } from "../types";
import { EnrollmentItem } from "./EnrollmentItem";
import { EmptyEnrollmentsState } from "./EmptyEnrollmentsState";

interface EnrollmentListProps {
  enrollments: EnrollmentViewModel[];
  loading: boolean;
  onWithdraw?: (ids: { childId: number; activityId: number }) => void;
}

export const EnrollmentList: React.FC<EnrollmentListProps> = ({ enrollments, loading, onWithdraw }) => {
  if (loading) {
    return <div className="text-sm text-gray-600">Ładowanie zapisów...</div>;
  }
  if (!loading && enrollments.length === 0) {
    return <EmptyEnrollmentsState />;
  }
  return (
    <ul className="divide-y">
      {enrollments.map((enr) => (
        <EnrollmentItem key={`${enr.childId}-${enr.activityId}`} enrollment={enr} onWithdraw={onWithdraw} />
      ))}
    </ul>
  );
};
