import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { LeaveReviewTable } from '../../components/leave/LeaveReviewTable';

export const AdminLeavePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Administration"
        description="Organization-wide workforce leave oversight, manager escalations, and executive reviews"
      />

      <section>
        <LeaveReviewTable mode="admin" />
      </section>
    </div>
  );
};

export default AdminLeavePage;
