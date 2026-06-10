/**
 * Branding Settings Page - Focus on Public Messaging
 */

import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, MessageSquare, Layout } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNotifications } from '../../hooks/useNotifications';
import { PRODUCT_DISPLAY_NAME } from '../../../../config/productIdentity';

const BrandingSettings = ({ brandingSettings, setBrandingSettings }) => {
  const { } = useNotifications();

  // State for branding messages only
  const [localSettings, setLocalSettings] = useState({
    welcomeTitle: brandingSettings?.welcomeTitle || '',
    welcomeMessage: brandingSettings?.welcomeMessage || '',
    onboardingTitle: brandingSettings?.onboardingTitle || '',
    onboardingMessage: brandingSettings?.onboardingMessage || ''
  });

  const [saving, setSaving] = useState(false);

  // Sync with parent state on mount/update
  useEffect(() => {
    setLocalSettings({
      welcomeTitle: brandingSettings?.welcomeTitle || '',
      welcomeMessage: brandingSettings?.welcomeMessage || '',
      onboardingTitle: brandingSettings?.onboardingTitle || '',
      onboardingMessage: brandingSettings?.onboardingMessage || ''
    });
  }, [brandingSettings]);

  const handleChange = (field, value) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Single-tenant: PUT /schools updates the one school record
      const { default: axiosInstance } = await import('../../../../services/api/axiosConfig');

      await axiosInstance.put('/schools', {
        welcomeTitle: localSettings.welcomeTitle,
        welcomeMessage: localSettings.welcomeMessage,
        onboardingTitle: localSettings.onboardingTitle,
        onboardingMessage: localSettings.onboardingMessage
      });

      // Update parent state (keep other branding fields intact)
      setBrandingSettings(prev => ({
        ...prev,
        ...localSettings
      }));

      toast.success('✨ Public messages saved successfully!');
      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      toast.error(error.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLocalSettings({
      welcomeTitle: `Welcome to ${brandingSettings?.schoolName || PRODUCT_DISPLAY_NAME}`,
      welcomeMessage: 'Empowering education through innovative learning management.',
      onboardingTitle: 'Join Our Community',
      onboardingMessage: 'Start your journey with us today. Create an account to access powerful tools for managing learning and assessment with ease.'
    });

    toast.success('🔄 Reset to default messages. Click "Save Changes" to persist.');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-medium text-gray-800">Public Portal Messaging</h2>
          <p className="text-sm text-gray-500">Customize the messages shown on your login and registration pages.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition font-medium"
          >
            <RefreshCw size={18} />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition shadow-sm ${saving ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Saving...' : 'Save Messages'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Column */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <MessageSquare className="text-blue-600" size={18} />
              <h3 className="font-medium text-gray-700">Auth Portal Content</h3>
            </div>
            <div className="p-6 space-y-8">
              {/* Login Page */}
              <div className="space-y-4">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-widest">Login Page</h4>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Welcome Title</label>
                  <input
                    type="text"
                    value={localSettings.welcomeTitle}
                    onChange={(e) => handleChange('welcomeTitle', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="e.g. Welcome back!"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Welcome Message</label>
                  <textarea
                    value={localSettings.welcomeMessage}
                    onChange={(e) => handleChange('welcomeMessage', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition resize-none"
                    placeholder="Short greeting for your users..."
                  />
                </div>
              </div>

              {/* Registration Page */}
              <div className="space-y-4 pt-4 border-t border-gray-50">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-widest">Registration Page</h4>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Onboarding Title</label>
                  <input
                    type="text"
                    value={localSettings.onboardingTitle}
                    onChange={(e) => handleChange('onboardingTitle', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="e.g. Create Account"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Onboarding Message</label>
                  <textarea
                    value={localSettings.onboardingMessage}
                    onChange={(e) => handleChange('onboardingMessage', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition resize-none"
                    placeholder="Encouraging message for new signups..."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-start">
            <Layout className="text-blue-500 mt-0.5" size={20} />
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Identity settings like School Name and Colors have been moved to
              <span className="font-medium"> School Settings</span> for unified management.
            </p>
          </div>
        </div>

        {/* Preview Column */}
        <div className="space-y-6">
          {/* Login Preview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center text-[10px] uppercase font-medium text-gray-400">
              <span>Portal Preview (Login)</span>
              <span>Visual Check</span>
            </div>
            <div
              className="p-10 text-white relative flex flex-col items-center text-center justify-center min-h-[300px]"
              style={{ backgroundColor: brandingSettings?.brandColor || 'var(--brand-purple)' }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <img
                src={brandingSettings?.logoUrl || '/branding/logo.png'}
                alt="Logo"
                className="w-20 h-20 object-contain mb-6 drop-shadow-lg"
                onError={(e) => e.target.src = '/branding/logo.png'}
              />
              <h3 className="text-xl font-semibold mb-2 tracking-tight">{localSettings.welcomeTitle || 'Welcome'}</h3>
              <p className="text-sm text-blue-50/80 leading-relaxed max-w-xs">{localSettings.welcomeMessage}</p>
            </div>
          </div>

          {/* Registration Preview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center text-[10px] uppercase font-medium text-gray-400">
              <span>Portal Preview (Onboarding)</span>
              <span>Visual Check</span>
            </div>
            <div
              className="p-10 text-white relative flex flex-col items-center text-center justify-center min-h-[300px]"
              style={{ backgroundColor: brandingSettings?.brandColor || 'var(--brand-purple)' }}
            >
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
              <img
                src={brandingSettings?.logoUrl || '/branding/logo.png'}
                alt="Logo"
                className="w-20 h-20 object-contain mb-6 drop-shadow-lg"
                onError={(e) => e.target.src = '/branding/logo.png'}
              />
              <h3 className="text-xl font-semibold mb-2 tracking-tight">{localSettings.onboardingTitle || 'Get Started'}</h3>
              <p className="text-sm text-blue-50/80 leading-relaxed max-w-xs">{localSettings.onboardingMessage}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandingSettings;
