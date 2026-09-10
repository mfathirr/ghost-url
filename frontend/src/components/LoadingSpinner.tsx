import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 gap-4">
      <div className="relative w-12 h-12">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 animate-pulse" />
        <div className="w-10 h-10 rounded-full border-2 border-transparent border-t-emerald-500 animate-spin absolute inset-0" />
      </div>
      <p className="text-xs font-mono text-slate-500 dark:text-slate-400 animate-pulse">
        {message}
      </p>
    </div>
  );
};
