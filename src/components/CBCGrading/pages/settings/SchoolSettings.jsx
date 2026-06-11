/**
 * School Settings Page - Unified Configuration Hub
 */

import React, { useState, useRef, useEffect } from 'react';
import { School, Save, Upload, X, AlertTriangle, MapPin, Loader2, Image as ImageIcon, Info, Phone, Mail, MessageSquare, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNotifications } from '../../hooks/useNotifications';
import axiosInstance from '../../../../services/api/axiosConfig';
import { PRODUCT_DISPLAY_NAME } from '../../../../config/productIdentity';

const normalizeHexColor = (value, fallback = '#030b82') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return fallback;
};

const SchoolSettings = ({ brandingSettings, setBrandingSettings }) => {
  const { showSuccess } = useNotifications();
  const fileInputRef = useRef(null);
  const faviconInputRef = useRef(null);
  const pwaLogoInputRef = useRef(null);
  const stampInputRef = useRef(null);

  // State for tabs
  const [activeTab, setActiveTab] = useState('general');

  // State for school settings - Unified Hub
  const [settings, setSettings] = useState({
    schoolName: brandingSettings?.schoolName || PRODUCT_DISPLAY_NAME,
    address: brandingSettings?.address || '',
    phone: brandingSettings?.phone || '',
    email: brandingSettings?.email || '',
    motto: brandingSettings?.motto || 'School Management System',
    vision: '',
    mission: '',
    latitude: null,
    longitude: null,
    geofenceRadiusMeters: 30,
    geofenceEnforcementMode: 'STRICT',
    primaryColor: normalizeHexColor(brandingSettings?.primaryColor, '#030b82'),
    secondaryColor: normalizeHexColor(brandingSettings?.secondaryColor, '#0D9488'),
    accentColor1: normalizeHexColor(brandingSettings?.accentColor1, '#3b82f6'),
    accentColor2: normalizeHexColor(brandingSettings?.accentColor2, '#e11d48'),
    logoUrl: brandingSettings?.logoUrl || '/branding/logo.png',
    faviconUrl: brandingSettings?.faviconUrl || '/branding/favicon.png',
    pwaLogoUrl: brandingSettings?.pwaLogoUrl || '/logo512.png',
    stampUrl: brandingSettings?.stampUrl || '/branding/stamp.svg',
    welcomeTitle: brandingSettings?.welcomeTitle || '',
    welcomeMessage: brandingSettings?.welcomeMessage || '',
    onboardingTitle: brandingSettings?.onboardingTitle || '',
    onboardingMessage: brandingSettings?.onboardingMessage || ''
  });

  const [previews, setPreviews] = useState({
    logo: brandingSettings?.logoUrl || '/branding/logo.png',
    favicon: brandingSettings?.faviconUrl || '/branding/favicon.png',
    pwaLogo: brandingSettings?.pwaLogoUrl || '/logo512.png',
    stamp: brandingSettings?.stampUrl || '/branding/stamp.svg'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Track initial state for dirty checking
  const [savedState, setSavedState] = useState({
    settings: {
      schoolName: brandingSettings?.schoolName || PRODUCT_DISPLAY_NAME,
      address: brandingSettings?.address || '',
      phone: brandingSettings?.phone || '',
      email: brandingSettings?.email || '',
      motto: brandingSettings?.motto || 'School Management System',
      vision: '',
      mission: '',
      latitude: null,
      longitude: null,
      geofenceRadiusMeters: 30,
      geofenceEnforcementMode: 'STRICT',
      primaryColor: normalizeHexColor(brandingSettings?.primaryColor, '#030b82'),
      secondaryColor: normalizeHexColor(brandingSettings?.secondaryColor, '#0D9488'),
      accentColor1: normalizeHexColor(brandingSettings?.accentColor1, '#3b82f6'),
      accentColor2: normalizeHexColor(brandingSettings?.accentColor2, '#e11d48'),
      logoUrl: brandingSettings?.logoUrl || '/branding/logo.png',
      faviconUrl: brandingSettings?.faviconUrl || '/branding/favicon.png',
      pwaLogoUrl: brandingSettings?.pwaLogoUrl || '/logo512.png',
      stampUrl: brandingSettings?.stampUrl || '/branding/stamp.svg',
      welcomeTitle: brandingSettings?.welcomeTitle || '',
      welcomeMessage: brandingSettings?.welcomeMessage || '',
      onboardingTitle: brandingSettings?.onboardingTitle || '',
      onboardingMessage: brandingSettings?.onboardingMessage || ''
    },
    previews: {
      logo: brandingSettings?.logoUrl || '/branding/logo.png',
      favicon: brandingSettings?.faviconUrl || '/branding/favicon.png',
      pwaLogo: brandingSettings?.pwaLogoUrl || '/logo512.png',
      stamp: brandingSettings?.stampUrl || '/branding/stamp.svg'
    }
  });

  // Check for unsaved changes
  const hasUnsavedChanges = savedState && (
    JSON.stringify(settings) !== JSON.stringify(savedState.settings) ||
    JSON.stringify(previews) !== JSON.stringify(savedState.previews)
  );

  // Warn on page leave if unsaved
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Fetch school data from backend on mount
  useEffect(() => {
    const fetchSchoolData = async () => {
      try {
        const response = await axiosInstance.get('/schools');
        const school = response.data?.data || response.data;

        if (school) {
          const fetchedSettings = {
            schoolName: school.name || school.schoolName || PRODUCT_DISPLAY_NAME,
            address: school.address || '',
            phone: school.phone || '',
            email: school.email || '',
            motto: school.motto || 'School Management System',
            vision: school.vision || '',
            mission: school.mission || '',
            latitude: school.latitude || null,
            longitude: school.longitude || null,
            geofenceRadiusMeters: school.geofenceRadiusMeters ?? 30,
            geofenceEnforcementMode: school.geofenceEnforcementMode || 'STRICT',
            primaryColor: normalizeHexColor(school.primaryColor, '#030b82'),
            secondaryColor: normalizeHexColor(school.secondaryColor, '#0D9488'),
            accentColor1: normalizeHexColor(school.accentColor1, '#3b82f6'),
            accentColor2: normalizeHexColor(school.accentColor2, '#e11d48'),
            logoUrl: school.logoUrl || '/branding/logo.png',
            faviconUrl: school.faviconUrl || '/branding/favicon.png',
            pwaLogoUrl: school.pwaLogoUrl || '/logo512.png',
            stampUrl: school.stampUrl || '/branding/stamp.svg',
            welcomeTitle: school.welcomeTitle || '',
            welcomeMessage: school.welcomeMessage || '',
            onboardingTitle: school.onboardingTitle || '',
            onboardingMessage: school.onboardingMessage || ''
          };

          const fetchedPreviews = {
            logo: fetchedSettings.logoUrl,
            favicon: fetchedSettings.faviconUrl,
            pwaLogo: fetchedSettings.pwaLogoUrl,
            stamp: fetchedSettings.stampUrl
          };

          setSettings(fetchedSettings);
          setPreviews(fetchedPreviews);
          setSavedState({
            settings: fetchedSettings,
            previews: fetchedPreviews
          });
        }
      } catch (error) {
        console.error('Error fetching school data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolData();
  }, []);



  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File size must be less than 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        setPreviews(prev => ({ ...prev, [type]: result }));
        setSettings(prev => ({ ...prev, [`${type}Url`]: result }));
        showSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} updated! Click "Save Changes" to persist.`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (type, defaultPath) => {
    setPreviews(prev => ({ ...prev, [type]: defaultPath }));
    setSettings(prev => ({ ...prev, [`${type}Url`]: defaultPath }));
    showSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} reset to default.`);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    const toastId = toast.loading('Fetching your location...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const lat = parseFloat(latitude.toFixed(6));
        const lon = parseFloat(longitude.toFixed(6));

        setSettings(prev => ({ ...prev, latitude: lat, longitude: lon }));

        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`);
          const data = await response.json();

          if (data && data.display_name) {
            const addr = data.address;
            const locationName = addr.city || addr.town || addr.village || addr.county || addr.state || data.name;
            const fullAddress = locationName ? `${locationName}, ${addr.country}` : data.display_name;

            setSettings(prev => ({ ...prev, address: fullAddress }));
            toast.success(`Location captured: ${fullAddress}!`, { id: toastId });
          } else {
            toast.success('Coordinates captured!', { id: toastId });
          }
        } catch (error) {
          console.error('Reverse geocoding error:', error);
          toast.success('Coordinates captured (address lookup failed).', { id: toastId });
        }
      },
      (error) => {
        toast.error('Failed to get location. Please enable location access.', { id: toastId });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: settings.schoolName,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        motto: settings.motto,
        vision: settings.vision,
        mission: settings.mission,
        logoUrl: settings.logoUrl,
        faviconUrl: settings.faviconUrl,
        pwaLogoUrl: settings.pwaLogoUrl,
        stampUrl: settings.stampUrl,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        accentColor1: settings.accentColor1,
        accentColor2: settings.accentColor2,
        latitude: settings.latitude,
        longitude: settings.longitude,
        geofenceRadiusMeters: settings.geofenceRadiusMeters,
        geofenceEnforcementMode: settings.geofenceEnforcementMode,
        welcomeTitle: settings.welcomeTitle,
        welcomeMessage: settings.welcomeMessage,
        onboardingTitle: settings.onboardingTitle,
        onboardingMessage: settings.onboardingMessage
      };

      // Avoid sending generated API asset URLs back to DB.
      // We only persist branding fields when they are actual values (data URI upload
      // or static branding path), otherwise keep existing DB value unchanged.
      const isGeneratedAssetUrl = (value) =>
        typeof value === 'string' && value.startsWith('/api/schools/public/assets/');

      if (isGeneratedAssetUrl(payload.logoUrl)) delete payload.logoUrl;
      if (isGeneratedAssetUrl(payload.faviconUrl)) delete payload.faviconUrl;
      if (isGeneratedAssetUrl(payload.pwaLogoUrl)) delete payload.pwaLogoUrl;
      if (isGeneratedAssetUrl(payload.stampUrl)) delete payload.stampUrl;

      await axiosInstance.put('/schools', payload);

      setSavedState({ settings: { ...settings }, previews: { ...previews } });
      toast.success('✅ School settings updated successfully!');

      // Push updated branding to app state immediately
      if (typeof setBrandingSettings === 'function') {
        setBrandingSettings({
          logoUrl: settings.logoUrl,
          faviconUrl: settings.faviconUrl,
          pwaLogoUrl: settings.pwaLogoUrl,
          stampUrl: settings.stampUrl,
          schoolName: settings.schoolName,
          primaryColor: settings.primaryColor,
          secondaryColor: settings.secondaryColor,
          accentColor1: settings.accentColor1,
          accentColor2: settings.accentColor2,
          motto: settings.motto,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          vision: settings.vision,
          mission: settings.mission,
          welcomeTitle: settings.welcomeTitle,
          welcomeMessage: settings.welcomeMessage,
          onboardingTitle: settings.onboardingTitle,
          onboardingMessage: settings.onboardingMessage
        });
      }

      // Sync local storage user object for header/sidebar immediate reflection
      try {
        const userString = localStorage.getItem('user');
        if (userString) {
          const user = JSON.parse(userString);
          if (user.school) {
            user.school.name = settings.schoolName;
            user.school.phone = settings.phone;
            user.school.email = settings.email;
            user.school.address = settings.address;
            user.school.motto = settings.motto;
            user.school.logoUrl = settings.logoUrl;
            user.school.pwaLogoUrl = settings.pwaLogoUrl;
            user.school.primaryColor = settings.primaryColor;
            user.school.secondaryColor = settings.secondaryColor;
            user.school.accentColor1 = settings.accentColor1;
            user.school.accentColor2 = settings.accentColor2;
            user.school.stampUrl = settings.stampUrl;
          }
          localStorage.setItem('user', JSON.stringify(user));
        }
      } catch (e) {
        console.error('Error updating user object in storage:', e);
      }

      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      const serverMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        error?.response?.data?.error ||
        error.message ||
        'Failed to sync with server.';
      toast.error(serverMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header with Save Button */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm mb-6">
        <div>
          <h2 className="text-2xl font-medium text-gray-800">School Configuration</h2>
          <p className="text-gray-500 text-sm">Manage your school's identity, branding, and contact details.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'general' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-200'
                }`}
            >
              General Defaults
            </button>
            <button
              onClick={() => setActiveTab('branding')}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'branding' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-200'
                }`}
            >
              Branding Settings
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all font-semibold shadow-md ${!hasUnsavedChanges
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : saving
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-lg'
              }`}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {hasUnsavedChanges && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded flex items-center gap-3 animate-in fade-in slide-in-from-top-2 mb-6">
          <AlertTriangle className="text-amber-500" size={20} />
          <p className="text-sm text-amber-800 flex-1">
            <strong>Unsaved Changes:</strong> You have modified settings that haven't been saved yet.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {activeTab === 'general' ? (
          /* Left Column: Identity & Contact */
          <div className="lg:col-span-12 space-y-6">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <School className="text-blue-600" size={20} />
                <h3 className="font-medium text-gray-700">School Identity</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">School Official Name</label>
                  <input
                    type="text"
                    value={settings.schoolName}
                    onChange={(e) => handleChange('schoolName', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder={`e.g. ${PRODUCT_DISPLAY_NAME} Academy`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">School Motto</label>
                  <input
                    type="text"
                    value={settings.motto}
                    onChange={(e) => handleChange('motto', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="e.g. Empowering Excellence"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 md:col-span-2">
                  {/* Primary Color */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.primaryColor}
                        onChange={(e) => handleChange('primaryColor', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 shadow-sm"
                      />
                      <input
                        type="text"
                        value={settings.primaryColor}
                        onChange={(e) => handleChange('primaryColor', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded font-mono text-[10px] uppercase"
                      />
                    </div>
                  </div>

                  {/* Secondary Color */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Secondary Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.secondaryColor}
                        onChange={(e) => handleChange('secondaryColor', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 shadow-sm"
                      />
                      <input
                        type="text"
                        value={settings.secondaryColor}
                        onChange={(e) => handleChange('secondaryColor', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded font-mono text-[10px] uppercase"
                      />
                    </div>
                  </div>

                  {/* Accent Color 1 */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Accent 1</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.accentColor1}
                        onChange={(e) => handleChange('accentColor1', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 shadow-sm"
                      />
                      <input
                        type="text"
                        value={settings.accentColor1}
                        onChange={(e) => handleChange('accentColor1', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded font-mono text-[10px] uppercase"
                      />
                    </div>
                  </div>

                  {/* Accent Color 2 */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Accent 2</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.accentColor2}
                        onChange={(e) => handleChange('accentColor2', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 shadow-sm"
                      />
                      <input
                        type="text"
                        value={settings.accentColor2}
                        onChange={(e) => handleChange('accentColor2', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded font-mono text-[10px] uppercase"
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <MapPin className="text-blue-600" size={20} />
                <h3 className="font-medium text-gray-700">Location & Contact</h3>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Physical Address</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={settings.address}
                        onChange={(e) => handleChange('address', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Street, City, County"
                      />
                    </div>
                    <button
                      onClick={handleGetLocation}
                      type="button"
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition whitespace-nowrap font-medium"
                    >
                      <MapPin size={18} />
                      Get GPS Location
                    </button>
                  </div>
                  {(settings.latitude || settings.longitude) && (
                    <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-3 font-mono">
                      <span className="bg-gray-50 px-2 py-0.5 rounded border border-gray-100">LAT: {settings.latitude}</span>
                      <span className="bg-gray-50 px-2 py-0.5 rounded border border-gray-100">LONG: {settings.longitude}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                      <Phone size={16} className="text-gray-400" />
                      Office Phone
                    </label>
                    <input
                      type="tel"
                      value={settings.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. +254 700 000 000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                      <Mail size={16} className="text-gray-400" />
                      Office Email
                    </label>
                    <input
                      type="email"
                      value={settings.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. info@school.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Info className="text-blue-600" size={20} />
                <h3 className="font-medium text-gray-700">Vision & Mission</h3>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Vision Statement</label>
                  <textarea
                    value={settings.vision}
                    onChange={(e) => handleChange('vision', e.target.value)}
                    rows="3"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="The long-term goal for the school..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mission Statement</label>
                  <textarea
                    value={settings.mission}
                    onChange={(e) => handleChange('mission', e.target.value)}
                    rows="3"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="How the school plans to achieve its vision..."
                  />
                </div>
              </div>
            </div>

            {/* ── Geofence / Clock-In Settings ── */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <ShieldCheck className="text-blue-600" size={20} />
                <h3 className="font-medium text-gray-700">Staff Clock-In Geofence</h3>
              </div>
              <div className="p-6 space-y-6">
                <p className="text-sm text-gray-500">
                  Controls whether staff must be physically at school to clock in.
                  The GPS pin is set via <strong>Get GPS Location</strong> above.
                  Browser GPS accuracy indoors is typically 5–50 m — keep the radius at least <strong>30 m</strong> to avoid false rejections.
                </p>

                {/* Enforcement mode */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Enforcement Mode</label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { value: 'STRICT', label: 'Strict', desc: 'Clock-in is blocked when outside the radius.' },
                      { value: 'SOFT',   label: 'Soft',   desc: 'Outside-radius clocks in but is flagged for review.' },
                      { value: 'OFF',    label: 'Off',    desc: 'No location check — anyone can clock in anywhere.' },
                    ].map(({ value, label, desc }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleChange('geofenceEnforcementMode', value)}
                        className={`flex-1 min-w-[140px] px-4 py-3 rounded-lg border-2 text-left transition ${
                          settings.geofenceEnforcementMode === value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className={`block text-sm font-bold ${settings.geofenceEnforcementMode === value ? 'text-blue-700' : 'text-gray-700'}`}>{label}</span>
                        <span className="block text-xs text-gray-500 mt-0.5">{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Radius slider + number input */}
                {settings.geofenceEnforcementMode !== 'OFF' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Allowed Radius
                      <span className="ml-2 text-blue-600 font-bold">{settings.geofenceRadiusMeters} m</span>
                      {settings.geofenceRadiusMeters < 30 && (
                        <span className="ml-2 text-amber-600 text-xs font-normal">⚠ Below 30 m may cause false rejections indoors</span>
                      )}
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="10"
                        max="500"
                        step="5"
                        value={settings.geofenceRadiusMeters}
                        onChange={(e) => handleChange('geofenceRadiusMeters', parseInt(e.target.value))}
                        className="flex-1 h-2 accent-blue-600 cursor-pointer"
                      />
                      <input
                        type="number"
                        min="1"
                        max="100000"
                        value={settings.geofenceRadiusMeters}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v >= 1) handleChange('geofenceRadiusMeters', v);
                        }}
                        className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <span className="text-sm text-gray-500 whitespace-nowrap">metres</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
                      <span>10 m</span>
                      <span>Recommended: 30–100 m</span>
                      <span>500 m</span>
                    </div>
                  </div>
                )}

                {/* GPS pin status */}
                <div className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                  settings.latitude && settings.longitude
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}>
                  <MapPin size={16} className="mt-0.5 shrink-0" />
                  {settings.latitude && settings.longitude ? (
                    <span>
                      GPS pin set — lat <strong>{settings.latitude}</strong>, lng <strong>{settings.longitude}</strong>.
                      Staff must be within <strong>{settings.geofenceRadiusMeters} m</strong> of this point to clock in
                      {settings.geofenceEnforcementMode === 'SOFT' ? ' (soft — logged but not blocked)' : ''}.
                    </span>
                  ) : (
                    <span>
                      No GPS pin set. Click <strong>Get GPS Location</strong> above while standing at school to set it.
                      Clock-in will be blocked until a pin is configured.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Branding Tab Content */
          <div className="lg:col-span-12 space-y-6">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <ImageIcon className="text-blue-600" size={20} />
                <h3 className="font-medium text-gray-700">Brand Assets</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Logo */}
                <div className="text-center group">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">School Logo</label>
                  <div className="relative mx-auto w-40 h-40 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center bg-gray-50 overflow-hidden transition-colors hover:border-blue-400 group-hover:bg-white shadow-inner">
                    <img src={previews.logo} alt="Logo" className="max-w-[85%] max-h-[85%] object-contain drop-shadow-sm" onError={(e) => e.target.src = '/branding/logo.png'} />
                    {previews.logo !== '/branding/logo.png' && (
                      <button onClick={() => handleRemoveImage('logo', '/branding/logo.png')} className="absolute top-2 right-2 w-7 h-7 bg-red-100 text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition shadow-sm flex items-center justify-center">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition">
                    <Upload size={16} />
                    Replace Logo
                  </button>
                </div>

                {/* Favicon */}
                <div className="text-center group">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Page Favicon</label>
                  <div className="relative mx-auto w-24 h-24 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center bg-gray-50 overflow-hidden transition-colors hover:border-blue-400 group-hover:bg-white shadow-inner mt-8">
                    <img src={previews.favicon} alt="Favicon" className="w-12 h-12 object-contain" onError={(e) => e.target.src = '/branding/favicon.png'} />
                    {previews.favicon !== '/branding/favicon.png' && (
                      <button onClick={() => handleRemoveImage('favicon', '/branding/favicon.png')} className="absolute top-1 right-1 w-6 h-6 bg-red-100 text-red-600 rounded-md opacity-0 group-hover:opacity-100 transition shadow-sm flex items-center justify-center">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <input ref={faviconInputRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'favicon')} className="hidden" />
                  <button onClick={() => faviconInputRef.current?.click()} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition">
                    <Upload size={16} />
                    Change Icon
                  </button>
                  <p className="text-[10px] text-gray-400 mt-1">Recommended: 32x32px PNG</p>
                </div>

                {/* PWA Logo */}
                <div className="text-center group">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">PWA App Icon</label>
                  <div className="relative mx-auto w-28 h-28 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center bg-gray-50 overflow-hidden transition-colors hover:border-blue-400 group-hover:bg-white shadow-inner mt-6">
                    <img src={previews.pwaLogo} alt="PWA App Icon" className="w-16 h-16 object-contain" onError={(e) => e.target.src = '/logo512.png'} />
                    {previews.pwaLogo !== '/logo512.png' && (
                      <button onClick={() => handleRemoveImage('pwaLogo', '/logo512.png')} className="absolute top-1 right-1 w-6 h-6 bg-red-100 text-red-600 rounded-md opacity-0 group-hover:opacity-100 transition shadow-sm flex items-center justify-center">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <input ref={pwaLogoInputRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'pwaLogo')} className="hidden" />
                  <button onClick={() => pwaLogoInputRef.current?.click()} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition">
                    <Upload size={16} />
                    Change PWA Icon
                  </button>
                  <p className="text-[10px] text-gray-400 mt-1">Recommended: 512x512px PNG (install app icon)</p>
                </div>

                {/* Official Stamp */}
                <div className="text-center group">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Official Stamp</label>
                  <div className="relative mx-auto w-40 h-40 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center bg-gray-50 overflow-hidden transition-colors hover:border-blue-400 group-hover:bg-white shadow-inner">
                    <img src={previews.stamp} alt="Stamp" className="max-w-[85%] max-h-[85%] object-contain" onError={(e) => e.target.src = '/branding/stamp.svg'} />
                    {previews.stamp !== '/branding/stamp.svg' && (
                      <button onClick={() => handleRemoveImage('stamp', '/branding/stamp.svg')} className="absolute top-2 right-2 w-7 h-7 bg-red-100 text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition shadow-sm flex items-center justify-center">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <input ref={stampInputRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'stamp')} className="hidden" />
                  <button onClick={() => stampInputRef.current?.click()} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition">
                    <Upload size={16} />
                    Update Stamp
                  </button>
                  <p className="text-[10px] text-gray-400 mt-1">Used on official reports & PDFs</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <MessageSquare className="text-blue-600" size={20} />
                <h3 className="font-medium text-gray-700">Auth Portal Messaging</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Welcome Title</label>
                  <input
                    type="text"
                    value={settings.welcomeTitle}
                    onChange={(e) => handleChange('welcomeTitle', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder={`e.g. Welcome to ${PRODUCT_DISPLAY_NAME}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Welcome Message</label>
                  <textarea
                    value={settings.welcomeMessage}
                    onChange={(e) => handleChange('welcomeMessage', e.target.value)}
                    rows="2"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="Short greeting for your users..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Onboarding Title</label>
                  <input
                    type="text"
                    value={settings.onboardingTitle}
                    onChange={(e) => handleChange('onboardingTitle', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="e.g. Join Our Community"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Onboarding Message</label>
                  <textarea
                    value={settings.onboardingMessage}
                    onChange={(e) => handleChange('onboardingMessage', e.target.value)}
                    rows="2"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="Message shown on registration page..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Preview */}
      <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-center border border-white/20">
            <img src={previews.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h4 className="text-3xl font-semibold tracking-tight mb-2 uppercase">{settings.schoolName || 'YOUR SCHOOL NAME'}</h4>
            <div className="flex flex-wrap justify-center md:justify-start gap-y-2 gap-x-6 text-blue-100 text-sm font-medium">
              <div className="flex items-center gap-2">
                <MapPin size={16} />
                {settings.address || 'Address not set'}
              </div>
              <div className="flex items-center gap-2">
                <Phone size={16} />
                {settings.phone || 'Phone not set'}
              </div>
              <div className="flex items-center gap-2">
                <Mail size={16} />
                {settings.email || 'Email not set'}
              </div>
            </div>
            {settings.motto && (
              <p className="mt-4 text-blue-200 italic font-serif">"{settings.motto}"</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchoolSettings;
