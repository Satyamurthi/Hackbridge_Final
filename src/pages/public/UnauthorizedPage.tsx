import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

export const UnauthorizedPage: React.FC = () => {
  const { role } = useAuth();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <h1 className="text-2xl font-bold text-slate-900">403 - Access Restricted</h1>
      <p className="text-xs sm:text-sm text-slate-500 max-w-md">
        Your current account role (<strong className="capitalize">{role?.replace('_', ' ') || 'Guest'}</strong>) does not have authorization to view this stakeholder workspace.
      </p>

      <div className="pt-2 flex gap-3">
        <Link to="/">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
};
