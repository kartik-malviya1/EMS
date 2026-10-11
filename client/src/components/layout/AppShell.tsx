import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Clock,
  History,
  LayoutDashboard,
  Users,
  ShieldCheck,
  FileText,
  Settings,
  Menu,
  LogOut,
  Camera,
  ChevronDown,
  Calendar,
  CalendarDays,
  Bell as BellIcon,
} from 'lucide-react';
import { useAppDispatch } from '../../app/hooks';
import { useLogoutMutation } from '../../features/auth/authApi';
import { useAuth } from '../../features/auth/useAuth';
import { apiSlice, setIntentionalLogout } from '../../features/api/apiSlice';
import { Button } from '../ui/button';
import { NotificationBell } from '../notifications/NotificationBell';
import { useRealtime } from '../../features/realtime/useRealtime';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { cn } from '../../lib/utils';
import type { Role } from '../../types/models';

import { ThemeSegmentedSwitch } from './ThemeSegmentedSwitch';

interface NavSection {
  title?: string;
  items: Array<{
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
  }>;
}

const getNavSections = (role?: Role): NavSection[] => {
  if (role === 'admin') {
    return [
      {
        title: 'MAIN',
        items: [
          { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
          { label: 'System Attendance', href: '/admin/attendance', icon: Calendar },
        ],
      },
      {
        title: 'EMPLOYEE & AUDITS',
        items: [
          { label: 'User Directory', href: '/admin/users', icon: Users },
          { label: 'Verification Audits', href: '/admin/review', icon: ShieldCheck },
          { label: 'Overtime Approvals', href: '/admin/overtime', icon: Clock },
          { label: 'Leave Oversight', href: '/admin/leave', icon: CalendarDays },
          { label: 'Reports & Export', href: '/admin/reports', icon: FileText },
        ],
      },
      {
        title: 'SYSTEM & SETTINGS',
        items: [
          { label: 'Geofence Settings', href: '/admin/settings', icon: Settings },
          { label: 'Notifications', href: '/notifications', icon: BellIcon },
        ],
      },
    ];
  }

  if (role === 'manager') {
    return [
      {
        title: 'MAIN',
        items: [
          { label: 'Team Overview', href: '/manager', icon: LayoutDashboard },
          { label: 'Team Attendance', href: '/manager/attendance', icon: Calendar },
        ],
      },
      {
        title: 'MANAGEMENT',
        items: [
          { label: 'Verification Queue', href: '/manager/review', icon: ShieldCheck },
          { label: 'Overtime Queue', href: '/manager/overtime', icon: Clock },
          { label: 'Leave Approvals', href: '/manager/leave', icon: CalendarDays },
          { label: 'Team Reports', href: '/manager/reports', icon: FileText },
        ],
      },
      {
        title: 'MY ATTENDANCE',
        items: [
          { label: "Today's Punch", href: '/employee', icon: Camera },
          { label: 'My History', href: '/employee/history', icon: History },
          { label: 'Leave & Time Off', href: '/employee/leave', icon: CalendarDays },
          { label: 'Notifications', href: '/notifications', icon: BellIcon },
        ],
      },
    ];
  }

  // Employee
  return [
    {
      title: 'MAIN',
      items: [
        { label: "Today's Punch", href: '/employee', icon: Clock },
        { label: 'My History', href: '/employee/history', icon: History },
        { label: 'Leave & Time Off', href: '/employee/leave', icon: CalendarDays },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { label: 'Notifications', href: '/notifications', icon: BellIcon },
      ],
    },
  ];
};

const NavSectionGroup: React.FC<{
  sections: NavSection[];
  pathname: string;
  onClick?: () => void;
}> = ({ sections, pathname, onClick }) => (
  <nav className="flex flex-col gap-4 px-3 py-3">
    {sections.map((section, sIdx) => (
      <div key={sIdx} className="space-y-1">
        {section.title && (
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            {section.title}
          </div>
        )}
        <div className="space-y-0.5">
          {section.items.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/employee' &&
                item.href !== '/admin' &&
                item.href !== '/manager' &&
                pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClick}
                className={cn(
                  'group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary font-bold shadow-xs'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  <span>{item.label}</span>
                </div>

                {/* Active indicator bar */}
                {isActive && (
                  <span className="h-4 w-1 rounded-full bg-primary shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    ))}
  </nav>
);

export const AppShell: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [logoutMutation] = useLogoutMutation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { status: socketStatus } = useRealtime();
  const navSections = getNavSections(user?.role);

  const handleLogout = async () => {
    setIntentionalLogout(true);
    try {
      await logoutMutation().unwrap();
    } catch {
      // Ignored
    } finally {
      dispatch(apiSlice.util.resetApiState());
      navigate('/login');
      setTimeout(() => setIntentionalLogout(false), 500);
    }
  };

  const getBreadcrumbs = (path: string): string[] => {
    if (path.startsWith('/admin')) {
      if (path === '/admin') return ['EMS', 'Admin', 'Dashboard'];
      if (path.startsWith('/admin/attendance')) return ['EMS', 'Admin', 'System Attendance'];
      if (path.startsWith('/admin/users')) return ['EMS', 'Admin', 'User Directory'];
      if (path.startsWith('/admin/review')) return ['EMS', 'Admin', 'Verification Audits'];
      if (path.startsWith('/admin/overtime')) return ['EMS', 'Admin', 'Overtime Approvals'];
      if (path.startsWith('/admin/reports')) return ['EMS', 'Admin', 'Reports'];
      if (path.startsWith('/admin/settings')) return ['EMS', 'Admin', 'Geofence Settings'];
    }
    if (path.startsWith('/manager')) {
      if (path === '/manager') return ['EMS', 'Manager', 'Team Overview'];
      if (path.startsWith('/manager/attendance')) return ['EMS', 'Manager', 'Team Attendance'];
      if (path.startsWith('/manager/review')) return ['EMS', 'Manager', 'Verification Queue'];
      if (path.startsWith('/manager/overtime')) return ['EMS', 'Manager', 'Overtime Queue'];
      if (path.startsWith('/manager/reports')) return ['EMS', 'Manager', 'Team Reports'];
    }
    if (path === '/employee') return ['EMS', 'Employee', "Today's Punch"];
    if (path === '/employee/history') return ['EMS', 'Employee', 'History'];
    if (path === '/notifications') return ['EMS', 'Notifications'];
    return ['EMS', 'Portal'];
  };

  const breadcrumbs = getBreadcrumbs(location.pathname);

  const roleSubtitle =
    user?.role === 'admin'
      ? 'HR Admin'
      : user?.role === 'manager'
        ? 'Team Manager'
        : 'Staff Employee';

  return (
    <div className="h-screen h-[100dvh] flex bg-background text-foreground overflow-hidden">
      {/* Desktop Sidebar (Full-height left column) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border/70 bg-card shrink-0 h-full overflow-hidden">
        {/* Sidebar Brand Header */}
        <div className="h-14 sm:h-16 shrink-0 flex items-center px-5 border-b border-border/60">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-primary-foreground font-black shadow-xs text-sm">
              E
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-sm tracking-tight text-foreground">
                EMS
              </span>
              <span className="text-[10px] text-muted-foreground font-medium tracking-wide">
                Attendance Management
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation links with smooth scroll container */}
        <div className="flex-1 overflow-y-auto min-h-0 py-3">
          <NavSectionGroup
            sections={navSections}
            pathname={location.pathname}
          />
        </div>

        {/* Sidebar Footer with Theme Switch */}
        <div className="p-3 border-t border-border/60 bg-card/50 shrink-0">
          <ThemeSegmentedSwitch />
        </div>
      </aside>

      {/* Main Content Area (Right column) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <header className="h-14 sm:h-16 shrink-0 border-b border-border/70 bg-card/80 backdrop-blur-md z-20 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile Sheet Trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 flex flex-col justify-between">
                <div className="flex flex-col min-h-0 flex-1">
                  <SheetHeader className="p-4 border-b shrink-0">
                    <SheetTitle className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground font-extrabold text-sm">
                        E
                      </div>
                      <span className="font-extrabold tracking-tight">EMS</span>
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <NavSectionGroup
                      sections={navSections}
                      pathname={location.pathname}
                      onClick={() => setMobileOpen(false)}
                    />
                  </div>
                </div>
                <div className="p-4 border-t border-border/70 bg-card/60 shrink-0">
                  <ThemeSegmentedSwitch />
                </div>
              </SheetContent>
            </Sheet>

            {/* Brand Logo on mobile */}
            <Link
              to="/"
              className="flex md:hidden items-center gap-2 font-bold tracking-tight text-sm text-foreground hover:opacity-90 transition-opacity"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-primary-foreground font-extrabold shadow-xs text-sm">
                E
              </div>
              <span className="font-extrabold tracking-tight">EMS</span>
            </Link>

            {/* Breadcrumbs on Desktop */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground/80 font-medium">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-muted-foreground/40 text-[10px]">●</span>}
                  <span
                    className={cn(
                      idx === breadcrumbs.length - 1
                        ? 'font-bold text-foreground'
                        : 'hover:text-foreground/80'
                    )}
                  >
                    {crumb}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Right Header Navigation */}
          <div className="flex items-center gap-2.5">
            {/* Live Socket Status Dot */}
            <div
              className={cn(
                'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                socketStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : socketStatus === 'connecting'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : 'bg-muted text-muted-foreground border-border/60'
              )}
              title={
                socketStatus === 'connected'
                  ? 'Real-time WebSocket active'
                  : socketStatus === 'connecting'
                    ? 'Connecting to real-time service...'
                    : 'Real-time offline'
              }
            >
              <span className="relative flex h-2 w-2">
                {socketStatus === 'connected' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={cn(
                    'relative inline-flex rounded-full h-2 w-2',
                    socketStatus === 'connected'
                      ? 'bg-emerald-500'
                      : socketStatus === 'connecting'
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-muted-foreground'
                  )}
                />
              </span>
              <span className="text-[11px] font-semibold">
                {socketStatus === 'connected'
                  ? 'Live System'
                  : socketStatus === 'connecting'
                    ? 'Connecting...'
                    : 'Offline'}
              </span>
            </div>

            {/* Notifications Bell */}
            <NotificationBell />

            {/* User Profile */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 pl-2 pr-3 py-1 h-9 rounded-full border border-border/70 hover:bg-muted/60 transition-all cursor-pointer"
                  >
                    <div className="h-7 w-7 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center text-xs uppercase ring-2 ring-primary/20">
                      {user.name?.charAt(0) || 'U'}
                    </div>
                    <div className="hidden sm:flex flex-col text-left leading-none">
                      <span className="text-xs font-bold text-foreground max-w-[120px] truncate">
                        {user.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {roleSubtitle}
                      </span>
                    </div>
                    <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1 rounded-2xl shadow-xl">
                  <DropdownMenuLabel className="font-normal p-3">
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs font-bold leading-none">{user.name}</p>
                      <p className="text-[11px] leading-none text-muted-foreground truncate">
                        {user.email}
                      </p>
                      <span className="capitalize text-[10px] font-semibold text-primary pt-1">
                        Role: {user.role}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive cursor-pointer rounded-xl text-xs font-semibold py-2"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Dedicated Scrollable Page Content Container */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
