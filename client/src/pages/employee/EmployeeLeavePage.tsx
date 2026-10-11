import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { LeaveApplyDialog } from '../../components/leave/LeaveApplyDialog';
import { LeaveHistoryTable } from '../../components/leave/LeaveHistoryTable';

export const EmployeeLeavePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave & Time Off"
        description="Apply for annual, sick, or casual leave, track working days, and view request approval history"
      >
        <LeaveApplyDialog />
      </PageHeader>

      <section>
        <LeaveHistoryTable />
      </section>
    </div>
  );
};

export default EmployeeLeavePage;
