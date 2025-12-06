import React from "react";
import AdminParentsToolbar from "./AdminParentsTable";

const AdminParentsPage: React.FC = () => {
  return (
    <section role="main" className="space-y-4">
      <div className="rounded-md border p-2">
        <AdminParentsToolbar />
      </div>
    </section>
  );
};

export default AdminParentsPage;
