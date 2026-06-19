import { useState, useEffect, FormEvent } from 'react';
import { User, Lock, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Layout from '../components/Layout.tsx';
import api from '../api/axios.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface ProfileData {
  id:         number;
  name:       string;
  email:      string;
  role:       string;
  created_at: string;
}

export default function Profile() {
  const { user: authUser } = useAuth();

  const [profile,  setProfile]  = useState<ProfileData | null>(null);
  const [loading,  setLoading]  = useState(true);

  // Name form
  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [nameError,   setNameError]   = useState('');
  const [nameSaving,  setNameSaving]  = useState(false);

  // Password form
  const [currentPassword,  setCurrentPassword]  = useState('');
  const [newPassword,      setNewPassword]      = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [showCurrent,      setShowCurrent]      = useState(false);
  const [showNew,          setShowNew]          = useState(false);
  const [showConfirm,      setShowConfirm]      = useState(false);
  const [passSuccess,      setPassSuccess]      = useState('');
  const [passError,        setPassError]        = useState('');
  const [passSaving,       setPassSaving]       = useState(false);

  useEffect(() => {
    api.get('/profile')
      .then(res => {
        setProfile(res.data);
        setName(res.data.name);
        setEmail(res.data.email);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleNameUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setNameError('');
    setNameSuccess('');
    setNameSaving(true);
    try {
      const res = await api.patch('/profile', { name, email });
      setProfile(prev => prev ? { ...prev, name: res.data.user.name, email: res.data.user.email } : prev);
      setNameSuccess('Profile updated successfully.');
      // Update localStorage user
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        localStorage.setItem('user', JSON.stringify({ ...u, name: res.data.user.name }));
      }
    } catch (err: any) {
      setNameError(err.response?.data?.message ?? err.response?.data?.errors?.email?.[0] ?? 'Failed to update profile.');
    } finally {
      setNameSaving(false);
    }
  };

  const handlePasswordUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match.');
      return;
    }

    setPassSaving(true);
    try {
      await api.patch('/profile', {
        current_password:      currentPassword,
        password:              newPassword,
        password_confirmation: confirmPassword,
      });
      setPassSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassError(
        err.response?.data?.errors?.current_password?.[0] ??
        err.response?.data?.errors?.password?.[0] ??
        err.response?.data?.message ??
        'Failed to change password.'
      );
    } finally {
      setPassSaving(false);
    }
  };

  const roleBadge = (role: string) =>
    role === 'admin'
      ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
      : 'bg-blue-500/15 text-blue-400 border border-blue-500/30';

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="p-8 space-y-6 max-w-2xl bg-gray-50 dark:bg-gray-950 min-h-screen transition-colors duration-200">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your account settings</p>
        </div>

        {/* Account info card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center shrink-0">
              <span className="text-gray-800 dark:text-white text-2xl font-bold">
                {profile?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-gray-900 dark:text-white font-semibold text-lg">{profile?.name}</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{profile?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadge(profile?.role ?? '')}`}>
                  {profile?.role}
                </span>
                <span className="text-gray-400 dark:text-gray-500 text-xs">
                  Member since {new Date(profile?.created_at ?? '').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit name + email */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-600/20 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-gray-900 dark:text-white font-semibold">Personal Information</h3>
              <p className="text-gray-400 dark:text-gray-500 text-xs">Update your name and email address</p>
            </div>
          </div>

          {nameSuccess && (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-3 mb-4">
              <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
              <p className="text-green-600 dark:text-green-400 text-sm">{nameSuccess}</p>
            </div>
          )}
          {nameError && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-3 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
              <p className="text-red-600 dark:text-red-400 text-sm">{nameError}</p>
            </div>
          )}

          <form onSubmit={handleNameUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={nameSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors text-sm"
              >
                {nameSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Change password */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-600/20 rounded-lg flex items-center justify-center">
              <Lock className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-gray-900 dark:text-white font-semibold">Change Password</h3>
              <p className="text-gray-400 dark:text-gray-500 text-xs">Must be at least 8 characters with uppercase and numbers</p>
            </div>
          </div>

          {passSuccess && (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-3 mb-4">
              <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
              <p className="text-green-600 dark:text-green-400 text-sm">{passSuccess}</p>
            </div>
          )}
          {passError && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-3 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
              <p className="text-red-600 dark:text-red-400 text-sm">{passError}</p>
            </div>
          )}

          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            {/* Current password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 pr-10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 pr-10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 pr-10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Password match indicator */}
              {confirmPassword && (
                <p className={`text-xs mt-1.5 ${newPassword === confirmPassword ? 'text-green-400' : 'text-red-400'}`}>
                  {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passSaving || newPassword !== confirmPassword}
                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors text-sm"
              >
                {passSaving ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </Layout>
  );
}
