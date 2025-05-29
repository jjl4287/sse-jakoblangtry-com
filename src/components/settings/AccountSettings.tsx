'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Key, Eye, EyeOff, Shield, Lock, Loader2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { toast } from 'sonner';

interface AuthStatus {
  hasPassword: boolean;
  hasOAuth: boolean;
  oauthProviders: string[];
  authMethods: {
    credentials: boolean;
    oauth: boolean;
  };
}

export const AccountSettings: React.FC = () => {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAuthStatus, setIsLoadingAuthStatus] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // Fetch auth status
  useEffect(() => {
    const fetchAuthStatus = async () => {
      try {
        const response = await fetch('/api/user/auth-status');
        if (response.ok) {
          const data = await response.json();
          setAuthStatus(data);
        } else {
          toast.error('Failed to load account information');
        }
      } catch (error) {
        console.error('Error fetching auth status:', error);
        toast.error('Failed to load account information');
      } finally {
        setIsLoadingAuthStatus(false);
      }
    };

    if (session?.user?.id) {
      fetchAuthStatus();
    }
  }, [session]);

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Must contain at least one number');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Must contain at least one special character');
    }
    
    return errors;
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear errors when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const newErrors: typeof errors = {};
    
    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    
    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else {
      const passwordErrors = validatePassword(formData.newPassword);
      if (passwordErrors.length > 0) {
        newErrors.newPassword = passwordErrors[0]; // Show first error
      }
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 400 && data.error?.includes('Current password')) {
          setErrors({ currentPassword: data.error });
        } else {
          toast.error(data.error || 'Failed to update password');
        }
        return;
      }
      
      // Success
      toast.success('Password updated successfully');
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setErrors({});
      
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = formData.currentPassword || formData.newPassword || formData.confirmPassword;
  const passwordStrength = formData.newPassword ? validatePassword(formData.newPassword) : [];

  if (isLoadingAuthStatus) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getAccountType = () => {
    if (!authStatus) return 'Unknown';
    
    if (authStatus.hasPassword && authStatus.hasOAuth) {
      return `Email & Password + ${authStatus.oauthProviders.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}`;
    } else if (authStatus.hasPassword) {
      return 'Email & Password';
    } else if (authStatus.hasOAuth) {
      return authStatus.oauthProviders.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
    }
    
    return 'Unknown';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Account Security</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Account Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Email</Label>
              <p className="text-sm font-medium">{session?.user?.email}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Account Type</Label>
              <p className="text-sm font-medium">{getAccountType()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Change Form */}
      {authStatus?.hasPassword && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5" />
              <span>Change Password</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={formData.currentPassword}
                    onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                    className={errors.currentPassword ? 'border-destructive' : ''}
                    placeholder="Enter your current password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {errors.currentPassword && (
                  <p className="text-sm text-destructive">{errors.currentPassword}</p>
                )}
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={formData.newPassword}
                    onChange={(e) => handleInputChange('newPassword', e.target.value)}
                    className={errors.newPassword ? 'border-destructive' : ''}
                    placeholder="Enter your new password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {errors.newPassword && (
                  <p className="text-sm text-destructive">{errors.newPassword}</p>
                )}
                
                {/* Password Requirements */}
                {formData.newPassword && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Password must contain:</p>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { check: formData.newPassword.length >= 8, text: 'At least 8 characters' },
                        { check: /[A-Z]/.test(formData.newPassword), text: 'One uppercase letter' },
                        { check: /[a-z]/.test(formData.newPassword), text: 'One lowercase letter' },
                        { check: /[0-9]/.test(formData.newPassword), text: 'One number' },
                        { check: /[^A-Za-z0-9]/.test(formData.newPassword), text: 'One special character' },
                      ].map((requirement, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            requirement.check ? 'bg-green-500' : 'bg-muted-foreground'
                          }`} />
                          <span className={`text-xs ${
                            requirement.check ? 'text-green-600' : 'text-muted-foreground'
                          }`}>
                            {requirement.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className={errors.confirmPassword ? 'border-destructive' : ''}
                    placeholder="Confirm your new password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  <span>Your password is encrypted and secure</span>
                </div>
                <Button
                  type="submit"
                  disabled={!hasChanges || isLoading || passwordStrength.length > 0}
                  className="min-w-[120px]"
                >
                  {isLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* OAuth Account Info or No Password Set */}
      {authStatus && !authStatus.hasPassword && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5" />
              <span>Password Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {authStatus.hasOAuth ? 'OAuth Account' : 'No Password Set'}
              </h3>
              <p className="text-muted-foreground">
                {authStatus.hasOAuth 
                  ? "You're signed in with an OAuth provider. Password changes are managed through your provider's account settings."
                  : "You don't have a password set for this account. Consider setting one for additional security."
                }
              </p>
              {authStatus.hasOAuth && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">Connected Providers:</p>
                  <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {authStatus.oauthProviders.map((provider) => (
                      <span
                        key={provider}
                        className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium"
                      >
                        {provider.charAt(0).toUpperCase() + provider.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 