import React from 'react';
import type { MigrationResult } from '~/lib/services/board-migration-service';
import { CheckCircle, AlertCircle, XCircle, X } from 'lucide-react';

interface MigrationBannerProps {
  migrationResult: MigrationResult;
  onClose: () => void;
}

export const MigrationBanner: React.FC<MigrationBannerProps> = ({ migrationResult, onClose }) => {
  const { success, migratedCount, errors, duplicateBoards } = migrationResult;

  if (migratedCount === 0 && errors.length === 0) {
    return null; // Nothing to show
  }

  const isPartialSuccess = success && errors.length > 0;
  const isFullFailure = !success && migratedCount === 0;

  const bgColor = isFullFailure 
    ? 'bg-gradient-to-r from-red-100 to-red-50'
    : isPartialSuccess 
    ? 'bg-gradient-to-r from-yellow-100 to-orange-50'
    : 'bg-gradient-to-r from-green-100 to-emerald-50';

  const textColor = isFullFailure 
    ? 'text-red-900'
    : isPartialSuccess 
    ? 'text-yellow-900'
    : 'text-green-900';

  const borderColor = isFullFailure 
    ? 'border-red-200'
    : isPartialSuccess 
    ? 'border-yellow-200'
    : 'border-green-200';

  const Icon = isFullFailure 
    ? XCircle
    : isPartialSuccess 
    ? AlertCircle
    : CheckCircle;

  return (
    <div className={`fixed top-0 left-0 right-0 ${bgColor} ${textColor} p-4 z-50 shadow-lg border-b ${borderColor}`}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start gap-3">
          <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold mb-2">
              {isFullFailure 
                ? 'Migration Failed'
                : isPartialSuccess 
                ? 'Migration Partially Completed'
                : 'Migration Successful!'
              }
            </div>
            
            {migratedCount > 0 && (
              <div className="mb-2">
                Successfully migrated {migratedCount} board{migratedCount !== 1 ? 's' : ''} to your account.
              </div>
            )}

            {duplicateBoards.length > 0 && (
              <div className="mb-2 text-sm">
                <strong>Renamed boards:</strong> {duplicateBoards.join(', ')} (had naming conflicts)
              </div>
            )}

            {errors.length > 0 && (
              <div className="text-sm">
                <strong>Issues:</strong>
                <ul className="mt-1 list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <button 
            onClick={onClose}
            className={`p-1 rounded hover:bg-black/10 transition-colors`}
            aria-label="Close migration banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}; 