import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeletons } from '../../components/common/Skeletons';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import {
  useGetNotificationsQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
} from '../../features/notifications/notificationsApi';
import {
  Check,
  CheckCheck,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

export const NotificationsPage: React.FC = () => {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useGetNotificationsQuery({
    unreadOnly: unreadOnly ? true : undefined,
    page,
    limit: 15,
  });

  const [markAsRead, { isLoading: isMarkingSingle }] =
    useMarkNotificationAsReadMutation();
  const [markAllAsRead, { isLoading: isMarkingAll }] =
    useMarkAllNotificationsAsReadMutation();

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead(id).unwrap();
    } catch {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead().unwrap();
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const notifications = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Notification Center"
          description="Real-time shift alerts, overtime status updates, and audit verification decisions"
        />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={isMarkingAll || notifications.length === 0}
            className="gap-1.5 text-xs"
          >
            <CheckCheck className="w-3.5 h-3.5 text-primary" /> Mark All as Read
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-3">
        <button
          type="button"
          onClick={() => {
            setUnreadOnly(false);
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            !unreadOnly
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          All Notifications
        </button>
        <button
          type="button"
          onClick={() => {
            setUnreadOnly(true);
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            unreadOnly
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          Unread Only
        </button>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <Skeletons count={4} />
      ) : isError ? (
        <ErrorState
          title="Could not load notifications"
          message="Failed to retrieve notification records. Please retry."
          onRetry={refetch}
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          title={
            unreadOnly
              ? 'No unread notifications'
              : 'No notifications found'
          }
          description={
            unreadOnly
              ? 'You are all caught up! Switch to All Notifications to view past alerts.'
              : 'New shift approvals, alerts, and system notices will appear here.'
          }
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const isUnread = !n.readAt;
            const nId = n.id || n._id || '';

            return (
              <Card
                key={nId}
                className={`transition-all duration-200 border ${
                  isUnread
                    ? 'border-primary/30 bg-primary/5 shadow-sm'
                    : 'border-border/70 bg-card hover:border-border'
                }`}
              >
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0 animate-pulse" />
                      )}
                      <h4
                        className={`text-sm font-bold ${
                          isUnread ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {n.title}
                      </h4>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                        {n.type.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {n.message}
                    </p>

                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 pt-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(n.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at{' '}
                        {new Date(n.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {isUnread && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkRead(nId)}
                      disabled={isMarkingSingle}
                      className="shrink-0 h-8 text-xs gap-1 self-start sm:self-center"
                    >
                      <Check className="w-3 h-3" /> Mark read
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="p-3 border border-border/70 rounded-xl flex items-center justify-between text-xs text-muted-foreground bg-card mt-4">
              <span>
                Page {meta.page} of {meta.totalPages} ({meta.total} notifications)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={meta.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
