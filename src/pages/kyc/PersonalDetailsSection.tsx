import React, { useState, useEffect } from 'react';
import { CircleUser as UserCircle, Save, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { UserProfile } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface PersonalDetailsSectionProps {
  userId: string;
  profile: UserProfile | null;
  kycLocked: boolean; // true when KYC is in_review or verified
  onSaved: () => void;
}

export default function PersonalDetailsSection({
  userId,
  profile,
  kycLocked,
  onSaved,
}: PersonalDetailsSectionProps) {
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [middleName, setMiddleName] = useState(profile?.middle_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setFirstName(profile?.first_name ?? '');
    setMiddleName(profile?.middle_name ?? '');
    setLastName(profile?.last_name ?? '');
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!firstName.trim()) { setError('First name is required.'); return; }
    if (!lastName.trim()) { setError('Last name is required.'); return; }

    setSaving(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/update-user-profile`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, first_name: firstName, middle_name: middleName, last_name: lastName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save profile.');
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSaved();
      }, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const inputBase =
    'w-full px-4 py-2.5 rounded-xl border-2 text-sm transition-colors outline-none';
  const inputEnabled =
    'border-gray-300 focus:border-[#8c76f0] focus:ring-2 focus:ring-purple-200';
  const inputDisabled =
    'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed';

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-300 hover:border-[#8c76f0] shadow-sm overflow-hidden transition-all">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-[#8c76f0]" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Personal Details</h3>
            <p className="text-sm text-gray-500">Your registration information</p>
          </div>
        </div>
        {kycLocked && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">
            <Lock className="w-3 h-3" />
            Read Only
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
        {kycLocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-sm text-amber-700">
              Personal details cannot be changed while KYC is under review or verified.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              First Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={kycLocked}
              placeholder="First name"
              className={`${inputBase} ${kycLocked ? inputDisabled : inputEnabled}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Middle Name
            </label>
            <input
              type="text"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              disabled={kycLocked}
              placeholder="Middle name (optional)"
              className={`${inputBase} ${kycLocked ? inputDisabled : inputEnabled}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Last Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={kycLocked}
              placeholder="Last name"
              className={`${inputBase} ${kycLocked ? inputDisabled : inputEnabled}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email ID
            </label>
            <input
              type="email"
              value={profile?.email ?? ''}
              disabled
              className={`${inputBase} ${inputDisabled}`}
            />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Phone Number
            </label>
            <input
              type="text"
              value={profile?.mobile_number ?? ''}
              disabled
              className={`${inputBase} ${inputDisabled}`}
            />
            <p className="text-xs text-gray-400 mt-1">Mobile number cannot be changed</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-500 rounded-xl px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-800 mt-0.5">{error}</p>
              </div>
            </div>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border-2 border-green-500 rounded-xl px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-green-900">Saved Successfully</p>
                <p className="text-sm text-green-800 mt-0.5">Personal details have been updated.</p>
              </div>
            </div>
          </div>
        )}

        {!kycLocked && (
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8c76f0] to-purple-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Details'}
          </button>
        )}
      </form>
    </div>
  );
}
