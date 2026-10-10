import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <div className="space-y-4 max-w-md">
        <span className="text-7xl font-extrabold text-primary/40 tracking-widest">
          404
        </span>
        <h1 className="text-3xl font-bold tracking-tight">Page Not Found</h1>
        <p className="text-muted-foreground text-sm">
          The page you are looking for does not exist, has been removed, or you don't have permission to access it.
        </p>

        <div className="flex items-center justify-center gap-3 pt-4">
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Go Back</span>
          </Button>
          <Link to="/">
            <Button className="gap-2">
              <Home className="h-4 w-4" />
              <span>Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
