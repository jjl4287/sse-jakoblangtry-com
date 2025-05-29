'use client';

import React from 'react';
import { Palette, Sun, Moon, Monitor } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import { useTheme } from '~/contexts/ThemeContext';
import { ThemeToggle } from '~/components/ui/ThemeToggle';

export const AppearanceSettings: React.FC = () => {
  const { theme, setTheme, toggleTheme } = useTheme();

  const themeOptions = [
    {
      id: 'light',
      label: 'Light',
      description: 'Light theme with bright backgrounds',
      icon: Sun,
    },
    {
      id: 'dark',
      label: 'Dark',
      description: 'Dark theme with dark backgrounds',
      icon: Moon,
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Palette className="h-5 w-5" />
            <span>Appearance Preferences</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Selection */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Color Theme</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Choose your preferred color scheme for the interface
              </p>
            </div>

            {/* Theme Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = theme === option.id;
                
                return (
                  <button
                    key={option.id}
                    onClick={() => setTheme(option.id as 'light' | 'dark')}
                    className={`relative p-4 border-2 rounded-lg text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-border/60 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`p-2 rounded-md ${
                          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{option.label}</h3>
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                    
                    {/* Preview */}
                    <div className="mt-4 p-3 rounded border bg-card">
                      <div className="space-y-2">
                        <div className="h-2 bg-primary/20 rounded"></div>
                        <div className="h-2 bg-muted rounded w-3/4"></div>
                        <div className="h-2 bg-muted rounded w-1/2"></div>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Theme Toggle Component */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
              <div>
                <Label className="text-sm font-medium">Quick Theme Toggle</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Use this toggle to quickly switch between light and dark modes
                </p>
              </div>
              <ThemeToggle />
            </div>
          </div>

          {/* Additional Appearance Settings */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Interface</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Customize how the interface looks and feels
              </p>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Reduced Motion</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimize animations and transitions
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Coming Soon
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-sm font-medium">High Contrast</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Increase contrast for better visibility
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Coming Soon
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Compact Mode</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Reduce spacing and padding for denser layouts
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Coming Soon
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 