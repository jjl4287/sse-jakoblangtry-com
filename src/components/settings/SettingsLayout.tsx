'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeft, User, Paperclip, Palette, Key } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { ProfileSettings } from './ProfileSettings';
import { AttachmentsSettings } from './AttachmentsSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { useRouter } from 'next/navigation';

type SettingsTab = 'profile' | 'attachments' | 'appearance' | 'account';

const settingsTabs = [
  {
    id: 'profile' as const,
    label: 'Profile',
    icon: User,
    description: 'Manage your profile information and avatar'
  },
  {
    id: 'attachments' as const,
    label: 'Attachments',
    icon: Paperclip,
    description: 'View and manage all your attachments'
  },
  {
    id: 'appearance' as const,
    label: 'Appearance',
    icon: Palette,
    description: 'Customize your theme and appearance'
  },
  {
    id: 'account' as const,
    label: 'Account',
    icon: Key,
    description: 'Account security and preferences'
  }
];

export const SettingsLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const { data: session } = useSession();
  const router = useRouter();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSettings />;
      case 'attachments':
        return <AttachmentsSettings />;
      case 'appearance':
        return <AppearanceSettings />;
      case 'account':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Account settings will be available in a future update.</p>
              </CardContent>
            </Card>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your account settings and preferences
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-right">
                <p className="text-sm font-medium">{session?.user?.name || session?.user?.email}</p>
                <p className="text-xs text-muted-foreground">
                  {session?.user?.email}
                </p>
              </div>
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt="Profile"
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xs font-medium">
                    {(session?.user?.name || session?.user?.email || 'U')[0].toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6">
                <nav className="space-y-2">
                  {settingsTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-start space-x-3 p-3 rounded-lg text-left transition-colors ${
                          isActive
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isActive ? 'text-primary' : ''}`}>
                            {tab.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {tab.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}; 