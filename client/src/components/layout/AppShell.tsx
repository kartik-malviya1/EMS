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

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const getNavItems = (role?: Role): NavItem[] => {
  if (role === 'admin') {
    return [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Attendance', href: '/admin/attendance', icon: Clock },
      { label: 'Selfie Review', href: '/admin/review', icon: ShieldCheck },
      { label: 'Overtime', href: '/admin/overtime', icon: Clock },
      { label: 'Reports', href: '/admin/reports', icon: FileText },
      { label: 'Geofence Settings', href: '/admin/settings', icon: Settings },
      { label: 'Punch Shift', href: '/employee', icon: Camera },
    ];
  }

  if (role === 'manager') {
    return [
      { label: 'Dashboard', href: '/manager', icon: LayoutDashboard },
      { label: 'Review Queue', href: '/manager/review', icon: ShieldCheck },
      { label: 'Overtime Queue', href: '/manager/overtime', icon: Clock },
      { label: 'Team Reports', href: '/manager/reports', icon: FileText },
      { label: 'Punch Shift', href: '/employee', icon: Camera },
    ];
  }

  // Employee
  return [
    { label: 'Dashboard & Punch', href: '/employee', icon: Clock },
    { label: 'My History', href: '/employee/history', icon: History },
  ];
};

const NavLinks: React.FC<{
  navItems: NavItem[];
  pathname: string;
  onClick?: () => void;
}> = ({ navItems, pathname, onClick }) => (
  <nav className="flex flex-col gap-1 px-2 py-4">
    {navItems.map((item) => {
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
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            isActive
              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>{item.label}</span>
        </Link>
      );
    })}
  </nav>
);

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [logoutMutation] = useLogoutMutation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = getNavItems(user?.role);

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

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md">
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
                  <SheetTitle className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                      A
                    </div>
                    <span>Attendance System</span>
                  </SheetTitle>
                </SheetHeader>
                <NavLinks
                  navItems={navItems}
                  pathname={location.pathname}
                  onClick={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-2.5 font-bold tracking-tight text-lg text-foreground hover:opacity-90"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-blue-600 text-primary-foreground font-extrabold shadow-sm">
                A
              </div>
              <span className="hidden sm:inline-block">AMS Portal</span>
            </Link>

            {user?.role && (
              <span className="hidden md:inline-flex uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-muted text-muted-foreground border">
                {user.role}
              </span>
            )}
          </div>

          {/* Right Header Icons */}
          <div className="flex items-center gap-2">
            <Link to="/notifications">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                className="relative"
              >
                <Bell className="h-5 w-5" />
              </Button>
            </Link>

            <ThemeToggle />

            {/* User Profile Dropdown */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 pl-2 pr-3 py-1 h-9 rounded-full border border-border/60 hover:bg-accent"
                  >
                    <div className="h-7 w-7 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs uppercase">
                      {user.name.charAt(0)}
                    </div>
                    <span className="hidden md:inline-block text-xs font-medium max-w-[120px] truncate">
                      {user.name}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive cursor-pointer"
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
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 border-r border-border/80 bg-card/40 shrink-0">
          <NavLinks navItems={navItems} pathname={location.pathname} />
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
