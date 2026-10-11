import React, { useState, useTransition } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { LeaveApplyDialog } from '../../components/leave/LeaveApplyDialog';
import { LeaveReviewTable } from '../../components/leave/LeaveReviewTable';
import { LeaveHistoryTable } from '../../components/leave/LeaveHistoryTable';
import { Users, History } from 'lucide-react';

export const ManagerLeavePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'team' | 'my'>('team');
  const [isPending, startTransition] = useTransition();

  const handleTabChange = (tab: 'team' | 'my') => {
    startTransition(() => {
      setActiveTab(tab);
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Leave Management"
        description="Review assigned team members' leave applications and manage your own workforce time off"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/70 mr-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'team'}
              onClick={() => handleTabChange('team')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'team'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Team Queue</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'my'}
              onClick={() => handleTabChange('my')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'my'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>My Leaves</span>
            </button>
          </div>

          <LeaveApplyDialog />
        </div>
      </PageHeader>

      <section
        aria-busy={isPending}
        className={`transition-opacity duration-150 ${isPending ? 'opacity-60' : 'opacity-100'}`}
      >
        {activeTab === 'team' ? (
          <LeaveReviewTable mode="manager" />
        ) : (
          <LeaveHistoryTable />
        )}
      </section>
    </div>
  );
};

export default ManagerLeavePage;
