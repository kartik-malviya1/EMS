import React from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
} from '../../features/notifications/notificationsApi';

export const NotificationBell: React.FC = () => {
  const { data: unreadCount = 0 } = useGetUnreadCountQuery();
  const { data: notificationsData } = useGetNotificationsQuery({ limit: 5 });
  const [markAsRead] = useMarkNotificationAsReadMutation();
  const [markAllAsRead, { isLoading: isMarkingAll }] =
    useMarkAllNotificationsAsReadMutation();

  const recentNotifications = notificationsData?.data || [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative h-9 w-9 rounded-xl hover:bg-muted"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              data-testid="unread-notification-badge"
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background animate-in zoom-in"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 p-2 rounded-2xl shadow-xl border-border/80"
      >
        <DropdownMenuLabel className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                disabled={isMarkingAll}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {recentNotifications.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No notifications yet</p>
            <p className="text-[11px] text-muted-foreground/70">
              Shift reminders and approvals will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto py-1">
            {recentNotifications.map((n) => {
              const isUnread = !n.readAt;
              const nId = n.id || n._id || '';

              return (
                <div
                  key={nId}
                  onClick={() => isUnread && markAsRead(nId)}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer text-left border ${
                    isUnread
                      ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                      : 'bg-card border-transparent hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-xs font-bold leading-tight ${
                        isUnread ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {n.title}
                    </span>
                    {isUnread && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {n.message}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground/70">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(n.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isUnread && (
                      <span className="text-primary font-semibold">
                        Click to mark read
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DropdownMenuSeparator />

        <div className="p-1">
          <Link
            to="/notifications"
            className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold text-primary hover:underline rounded-lg hover:bg-muted/50 transition-colors"
          >
            <span>View All Notifications</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
