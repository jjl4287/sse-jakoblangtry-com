import React from 'react';
import { signIn } from 'next-auth/react';
import { Cloud, Save, X, ArrowRight } from 'lucide-react';

interface LocalBoardBannerProps {
  onClose: () => void;
}

export const LocalBoardBanner: React.FC<LocalBoardBannerProps> = ({ onClose }) => {
  return (
    <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-blue-200/50 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
              <Save className="w-4 h-4 text-blue-600" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 text-blue-900">
                <span className="font-medium text-sm">
                  Working locally
                </span>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              </div>
              <p className="text-xs text-blue-700 mt-0.5">
                Your boards are saved locally. Sign in to sync across devices and access from anywhere.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => signIn()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Cloud className="w-4 h-4" />
              Sign in to sync
              <ArrowRight className="w-3 h-3" />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors"
              aria-label="Close banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 