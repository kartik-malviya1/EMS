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
  Bell,
  Menu,
  LogOut,
  Camera,
  ChevronDown,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useLogoutMutation } from '../../features/auth/authApi';
import { logoutUser } from '../../features/auth/authSlice';
import { Button } from '../ui/button';
import { ThemeToggle } from './ThemeToggle';
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

interface NavSection {
  title?: string;
  items: Array<{
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

const getNavSections = (role?: Role): NavSection[] => {
  if (role === 'admin') {
    return [
      {
        title: 'Administration',
        items: [
          { label: 'Admin Overview', href: '/admin', icon: LayoutDashboard },
          { label: 'User Directory', href: '/admin/users', icon: Users },
          { label: 'System Attendance', href: '/admin/attendance', icon: Calendar },
          { label: 'Verification Audits', href: '/admin/review', icon: ShieldCheck },
          { label: 'Overtime Approvals', href: '/admin/overtime', icon: Clock },
          { label: 'Reports & Export', href: '/admin/reports', icon: FileText },
          { label: 'Geofence Settings', href: '/admin/settings', icon: Settings },
        ],
      },
      {
        title: 'Personal Shift',
        items: [
          { label: "Today's Punch", href: '/employee', icon: Camera },
          { label: 'My History', href: '/employee/history', icon: History },
        ],
      },
    ];
  }

  if (role === 'manager') {
    return [
      {
        title: 'Team Management',
        items: [
          { label: 'Team Overview', href: '/manager', icon: LayoutDashboard },
          { label: 'Team Attendance', href: '/manager/attendance', icon: Calendar },
          { label: 'Verification Queue', href: '/manager/review', icon: ShieldCheck },
          { label: 'Overtime Queue', href: '/manager/overtime', icon: Clock },
          { label: 'Team Reports', href: '/manager/reports', icon: FileText },
        ],
      },
      {
        title: 'Personal Shift',
        items: [
          { label: "Today's Punch", href: '/employee', icon: Camera },
          { label: 'My History', href: '/employee/history', icon: History },
        ],
      },
    ];
  }

  // Employee
  return [
    {
      title: 'Personal Shift',
      items: [
        { label: "Today's Punch", href: '/employee', icon: Clock },
        { label: 'My History', href: '/employee/history', icon: History },
      ],
    },
  ];
};

const NavSectionGroup: React.FC<{
  sections: NavSection[];
  pathname: string;
  onClick?: () => void;
}> = ({ sections, pathname, onClick }) => (
  <nav className="flex flex-col gap-5 px-3 py-4">
    {sections.map((section, sIdx) => (
      <div key={sIdx} className="space-y-1">
        {section.title && (
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {section.title}
          </div>
        )}
        <div className="space-y-0.5">
          {section.items.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/employee' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClick}
                className={cn(
                  'group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActive
                        ? 'text-primary-foreground'
                        : 'text-muted-foreground group-hover:text-primary'
                    )}
                  />
                  <span>{item.label}</span>
                </div>
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
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [logoutMutation] = useLogoutMutation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navSections = getNavSections(user?.role);

  const handleLogout = async () => {
    try {
      await logoutMutation().unwrap();
    } catch {
      // Ignored
    } finally {
      dispatch(logoutUser());
      navigate('/login');
    }
  };

  const portalBadge =
    user?.role === 'admin'
      ? 'Admin Portal'
      : user?.role === 'manager'
        ? 'Employee Portal (Manager)'
        : 'Employee Portal';

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
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
              <SheetContent side="left" className="p-0 w-72">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
                      E
                    </div>
                    <span>EMS Portal</span>
                  </SheetTitle>
                </SheetHeader>
                <NavSectionGroup
                  sections={navSections}
                  pathname={location.pathname}
                  onClick={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>

            {/* Brand Logo */}
            <Link
              to="/"
              className="flex items-center gap-2.5 font-bold tracking-tight text-base text-foreground hover:opacity-90 transition-opacity"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-primary-foreground font-extrabold shadow-sm">
                E
              </div>
              <div className="hidden sm:block">
                <span className="font-extrabold tracking-tight">EMS</span>
                <span className="text-primary font-bold ml-1">Portal</span>
              </div>
            </Link>

            {/* Portal Badge */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="w-3 h-3" />
              <span>{portalBadge}</span>
            </div>
          </div>

          {/* Right Header Navigation */}
          <div className="flex items-center gap-2">
            {/* Live Socket Status Dot */}
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              title="Real-time WebSocket active"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-semibold">Live System</span>
            </div>

            {/* Notifications Bell */}
            <Link to="/notifications">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                className="relative h-9 w-9 rounded-xl hover:bg-muted"
              >
                <Bell className="h-4 w-4" />
              </Button>
            </Link>

            <ThemeToggle />

            {/* User Profile Dropdown */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 pl-2 pr-3 py-1 h-9 rounded-full border border-border/60 hover:bg-muted/60"
                  >
                    <div className="h-7 w-7 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs uppercase">
                      {user.name?.charAt(0) || 'U'}
                    </div>
                    <span className="hidden md:inline-block text-xs font-semibold max-w-[120px] truncate">
                      {user.name}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1 rounded-2xl">
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
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex">
        {/* Desktop Sidebar with tanX inspired styling */}
        <aside className="hidden md:flex flex-col w-64 border-r border-border/70 bg-card/50 backdrop-blur-sm shrink-0">
          <NavSectionGroup
            sections={navSections}
            pathname={location.pathname}
          />
        </aside>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
