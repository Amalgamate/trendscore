/**
 * School Settings Page - Unified Configuration Hub
 */

import React, { useState, useRef, useEffect } from 'react';
import { School, Save, Upload, X, AlertTriangle, MapPin, Loader2, Image as ImageIcon, Info, Phone, Mail, MessageSquare, ShieldCheck, Wifi, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNotifications } from '../../hooks/useNotifications';
import axiosInstance from '../../../../services/api/axiosConfig';
import { PRODUCT_DISPLAY_NAME } from '../../../../config/productIdentity';
import SettingsPageShell from '../../shared/SettingsPageShell';

const cleanSchoolName = (value) => String(value || '').trim();

const traceRoundedRect = (context, x, y, width, height, radius) => {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
};

const createWhitePwaIcon = (source) => new Promise((resolve, reject) => {
  if (!source || typeof document === 'undefined') {
    reject(new Error('Favicon source is unavailable'));
    return;
  }
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext('2d');

      // Keep transparent breathing room so the rounded card and restrained
      // shadow remain visible on Windows and other desktop launchers.
      context.clearRect(0, 0, 512, 512);
      context.save();
      context.shadowColor = 'rgba(15, 23, 42, 0.14)';
      context.shadowBlur = 18;
      context.shadowOffsetY = 6;
      context.fillStyle = '#ffffff';
      traceRoundedRect(context, 32, 26, 448, 448, 72);
      context.fill();
      context.restore();

      const scale = Math.min(336 / image.naturalWidth, 336 / image.naturalHeight);
      const width = Math.max(1, image.naturalWidth * scale);
      const height = Math.max(1, image.naturalHeight * scale);
      context.drawImage(image, (512 - width) / 2, (512 - height) / 2, width, height);
      resolve(canvas.toDataURL('image/png'));
    } catch (error) {
      reject(error);
    }
  };
  image.onerror = () => reject(new Error('Could not prepare the install icon'));
  image.src = source;
});

// Older school records use the static product icon as the PWA value. Treat it
// as an unset legacy fallback so the installed app follows the page favicon.
const resolvePwaIconUrl = (pwaLogoUrl, faviconUrl) => {
  if (pwaLogoUrl && pwaLogoUrl !== '/logo512.png') return pwaLogoUrl;
  return faviconUrl || '/logo512.png';
};

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
  const stampInputRef = useRef(null);

  // State for tabs
  const [activeTab, setActiveTab] = useState('general');

  // State for school settings - Unified Hub
  const [settings, setSettings] = useState({
    schoolName: cleanSchoolName(brandingSettings?.schoolName),
    address: brandingSettings?.address || '',
    phone: brandingSettings?.phone || '',
    email: brandingSettings?.email || '',
    motto: brandingSettings?.motto || 'School Management System',
    vision: '',
    mission: '',
    latitude: null,
    longitude: null,
    geofenceRadiusMeters: 30,
    geofenceEnforcementMode: 'OFF',
    allowedClockInIps: '',
    staffWorkStartTime: '07:30',
    staffWorkEndTime: '16:30',
    staffRequiredMinutes: 480,
    staffPartialDayMinutes: 240,
    staffWorkingDays: [1, 2, 3, 4, 5],
    primaryColor: normalizeHexColor(brandingSettings?.primaryColor, '#030b82'),
    secondaryColor: normalizeHexColor(brandingSettings?.secondaryColor, '#0D9488'),
    accentColor1: normalizeHexColor(brandingSettings?.accentColor1, '#3b82f6'),
    accentColor2: normalizeHexColor(brandingSettings?.accentColor2, '#e11d48'),
    logoUrl: brandingSettings?.logoUrl || '/branding/logo.png',
    faviconUrl: brandingSettings?.faviconUrl || '/branding/favicon.png',
    pwaLogoUrl: resolvePwaIconUrl(brandingSettings?.pwaLogoUrl, brandingSettings?.faviconUrl),
    stampUrl: brandingSettings?.stampUrl || '/branding/stamp.svg',
    welcomeTitle: brandingSettings?.welcomeTitle || '',
    welcomeMessage: brandingSettings?.welcomeMessage || '',
    onboardingTitle: brandingSettings?.onboardingTitle || '',
    onboardingMessage: brandingSettings?.onboardingMessage || ''
  });

  const [previews, setPreviews] = useState({
    logo: brandingSettings?.logoUrl || '/branding/logo.png',
    favicon: brandingSettings?.faviconUrl || '/branding/favicon.png',
    pwaLogo: resolvePwaIconUrl(brandingSettings?.pwaLogoUrl, brandingSettings?.faviconUrl),
    stamp: brandingSettings?.stampUrl || '/branding/stamp.svg'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Track initial state for dirty checking
  const [savedState, setSavedState] = useState({
    settings: {
      schoolName: cleanSchoolName(brandingSettings?.schoolName),
      address: brandingSettings?.address || '',
      phone: brandingSettings?.phone || '',
      email: brandingSettings?.email || '',
      motto: brandingSettings?.motto || 'School Management System',
      vision: '',
      mission: '',
      latitude: null,
      longitude: null,
      geofenceRadiusMeters: 30,
      geofenceEnforcementMode: 'OFF',
      allowedClockInIps: '',
      staffWorkStartTime: '07:30',
      staffWorkEndTime: '16:30',
      staffRequiredMinutes: 480,
      staffPartialDayMinutes: 240,
      staffWorkingDays: [1, 2, 3, 4, 5],
      primaryColor: normalizeHexColor(brandingSettings?.primaryColor, '#030b82'),
      secondaryColor: normalizeHexColor(brandingSettings?.secondaryColor, '#0D9488'),
      accentColor1: normalizeHexColor(brandingSettings?.accentColor1, '#3b82f6'),
      accentColor2: normalizeHexColor(brandingSettings?.accentColor2, '#e11d48'),
      logoUrl: brandingSettings?.logoUrl || '/branding/logo.png',
      faviconUrl: brandingSettings?.faviconUrl || '/branding/favicon.png',
      pwaLogoUrl: resolvePwaIconUrl(brandingSettings?.pwaLogoUrl, brandingSettings?.faviconUrl),
      stampUrl: brandingSettings?.stampUrl || '/branding/stamp.svg',
      welcomeTitle: brandingSettings?.welcomeTitle || '',
      welcomeMessage: brandingSettings?.welcomeMessage || '',
      onboardingTitle: brandingSettings?.onboardingTitle || '',
      onboardingMessage: brandingSettings?.onboardingMessage || ''
    },
    previews: {
      logo: brandingSettings?.logoUrl || '/branding/logo.png',
      favicon: brandingSettings?.faviconUrl || '/branding/favicon.png',
      pwaLogo: resolvePwaIconUrl(brandingSettings?.pwaLogoUrl, brandingSettings?.faviconUrl),
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
            schoolName: cleanSchoolName(school.name || school.schoolName),
            address: school.address || '',
            phone: school.phone || '',
            email: school.email || '',
            motto: school.motto || 'School Management System',
            vision: school.vision || '',
            mission: school.mission || '',
            latitude: school.latitude || null,
            longitude: school.longitude || null,
            geofenceRadiusMeters: school.geofenceRadiusMeters ?? 30,
            geofenceEnforcementMode: school.geofenceEnforcementMode || 'OFF',
            allowedClockInIps: school.allowedClockInIps || '',
            staffWorkStartTime: school.staffWorkStartTime || '07:30',
            staffWorkEndTime: school.staffWorkEndTime || '16:30',
            staffRequiredMinutes: school.staffRequiredMinutes ?? 480,
            staffPartialDayMinutes: school.staffPartialDayMinutes ?? 240,
            staffWorkingDays: Array.isArray(school.staffWorkingDays) ? school.staffWorkingDays : [1, 2, 3, 4, 5],
            primaryColor: normalizeHexColor(school.primaryColor, '#030b82'),
            secondaryColor: normalizeHexColor(school.secondaryColor, '#0D9488'),
            accentColor1: normalizeHexColor(school.accentColor1, '#3b82f6'),
            accentColor2: normalizeHexColor(school.accentColor2, '#e11d48'),
            logoUrl: school.logoUrl || '/branding/logo.png',
            faviconUrl: school.faviconUrl || '/branding/favicon.png',
            pwaLogoUrl: resolvePwaIconUrl(school.pwaLogoUrl, school.faviconUrl),
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

          if (typeof setBrandingSettings === 'function') {
            setBrandingSettings(prev => ({
              ...prev,
              logoUrl: fetchedSettings.logoUrl,
              faviconUrl: fetchedSettings.faviconUrl,
              pwaLogoUrl: fetchedSettings.pwaLogoUrl,
              stampUrl: fetchedSettings.stampUrl,
              schoolName: fetchedSettings.schoolName,
              primaryColor: fetchedSettings.primaryColor,
              secondaryColor: fetchedSettings.secondaryColor,
              accentColor1: fetchedSettings.accentColor1,
              accentColor2: fetchedSettings.accentColor2,
              motto: fetchedSettings.motto,
              address: fetchedSettings.address,
              phone: fetchedSettings.phone,
              email: fetchedSettings.email,
            }));
          }
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
      reader.onloadend = async () => {
        const result = reader.result;
        const pwaIcon = type === 'favicon'
          ? await createWhitePwaIcon(result).catch(() => result)
          : result;
        setPreviews(prev => ({
          ...prev,
          [type]: result,
          ...(type === 'favicon' ? { pwaLogo: pwaIcon } : {}),
        }));
        setSettings(prev => ({
          ...prev,
          [`${type}Url`]: result,
          ...(type === 'favicon' ? { pwaLogoUrl: pwaIcon } : {}),
        }));
        showSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} updated! Click "Save Changes" to persist.`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (type, defaultPath) => {
    setPreviews(prev => ({
      ...prev,
      [type]: defaultPath,
      ...(type === 'favicon' ? { pwaLogo: '/logo512.png' } : {}),
    }));
    setSettings(prev => ({
      ...prev,
      [`${type}Url`]: defaultPath,
      ...(type === 'favicon' ? { pwaLogoUrl: '/logo512.png' } : {}),
    }));
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
      const explicitSchoolName = cleanSchoolName(settings.schoolName);
      const linkedPwaLogoUrl = await createWhitePwaIcon(settings.faviconUrl)
        .catch(() => resolvePwaIconUrl(settings.pwaLogoUrl, settings.faviconUrl));
      const payload = {
        ...(explicitSchoolName ? { name: explicitSchoolName } : {}),
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        motto: settings.motto,
        vision: settings.vision,
        mission: settings.mission,
        logoUrl: settings.logoUrl,
        faviconUrl: settings.faviconUrl,
        pwaLogoUrl: linkedPwaLogoUrl,
        stampUrl: settings.stampUrl,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        accentColor1: settings.accentColor1,
        accentColor2: settings.accentColor2,
        latitude: settings.latitude,
        longitude: settings.longitude,
        geofenceRadiusMeters: settings.geofenceRadiusMeters,
        geofenceEnforcementMode: settings.geofenceEnforcementMode,
        allowedClockInIps: settings.allowedClockInIps || null,
        staffWorkStartTime: settings.staffWorkStartTime,
        staffWorkEndTime: settings.staffWorkEndTime,
        staffRequiredMinutes: Number(settings.staffRequiredMinutes),
        staffPartialDayMinutes: Number(settings.staffPartialDayMinutes),
        staffWorkingDays: settings.staffWorkingDays,
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

      const savedSettings = { ...settings, schoolName: explicitSchoolName, pwaLogoUrl: linkedPwaLogoUrl };
      setSettings(savedSettings);
      setPreviews(current => ({ ...current, pwaLogo: linkedPwaLogoUrl }));
      setSavedState({ settings: savedSettings, previews: { ...previews, pwaLogo: linkedPwaLogoUrl } });
      toast.success('✅ School settings updated successfully!');

      // Push updated branding to app state immediately
      if (typeof setBrandingSettings === 'function') {
        setBrandingSettings({
          logoUrl: settings.logoUrl,
          faviconUrl: settings.faviconUrl,
          pwaLogoUrl: linkedPwaLogoUrl,
          stampUrl: settings.stampUrl,
          schoolName: explicitSchoolName,
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
            user.school.name = explicitSchoolName;
            user.school.phone = settings.phone;
            user.school.email = settings.email;
            user.school.address = settings.address;
            user.school.motto = settings.motto;
            user.school.logoUrl = settings.logoUrl;
            user.school.pwaLogoUrl = linkedPwaLogoUrl;
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
    <SettingsPageShell width="wide">
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

            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Clock className="text-indigo-600" size={20} />
                <h3 className="font-medium text-gray-700">Staff Attendance Policy</h3>
              </div>
              <div className="p-6 space-y-5">
                <p className="text-sm text-gray-500">These settings drive late arrivals, partial days, expected working days, overtime and HR attendance reports.</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <label className="text-sm font-medium text-gray-700">Work starts
                    <input type="time" value={settings.staffWorkStartTime} onChange={(e) => handleChange('staffWorkStartTime', e.target.value)} className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2" />
                  </label>
                  <label className="text-sm font-medium text-gray-700">Work ends
                    <input type="time" value={settings.staffWorkEndTime} onChange={(e) => handleChange('staffWorkEndTime', e.target.value)} className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2" />
                  </label>
                  <label className="text-sm font-medium text-gray-700">Full day (minutes)
                    <input type="number" min="60" max="1440" value={settings.staffRequiredMinutes} onChange={(e) => handleChange('staffRequiredMinutes', Number(e.target.value))} className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2" />
                  </label>
                  <label className="text-sm font-medium text-gray-700">Partial below (minutes)
                    <input type="number" min="30" max="1439" value={settings.staffPartialDayMinutes} onChange={(e) => handleChange('staffPartialDayMinutes', Number(e.target.value))} className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2" />
                  </label>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">Working days</p>
                  <div className="flex flex-wrap gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, day) => {
                      const selected = settings.staffWorkingDays.includes(day);
                      return <button key={label} type="button" onClick={() => handleChange('staffWorkingDays', selected ? settings.staffWorkingDays.filter((value) => value !== day) : [...settings.staffWorkingDays, day].sort())} className={`rounded-lg border px-3 py-2 text-sm font-medium ${selected ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'}`}>{label}</button>;
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Staff Clock-In: IP / Wi-Fi Restriction ── */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Wifi className="text-blue-600" size={20} />
                <h3 className="font-medium text-gray-700">Staff Clock-In: Wi-Fi / IP Restriction</h3>
              </div>
              <div className="p-6 space-y-5">
                <p className="text-sm text-gray-500">
                  Staff can only clock in when connected to an approved network.
                  Enter the school Wi-Fi's public IP address(es) below — one per line or comma-separated.
                  Leave blank to allow clock-in from any network (unrestricted).
                </p>

                {/* Allowed IPs textarea */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Allowed Wi-Fi IP Addresses
                  </label>
                  <textarea
                    rows={4}
                    value={settings.allowedClockInIps}
                    onChange={(e) => handleChange('allowedClockInIps', e.target.value)}
                    placeholder={`e.g.\n197.248.10.5\n41.90.64.200\n10.0.0.0/24`}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    IPv4 addresses or CIDR prefixes, comma-separated or one per line.
                    Tip: visit <a href="https://whatismyip.com" target="_blank" rel="noreferrer" className="underline hover:text-blue-600">whatismyip.com</a> from the school network to find your public IP.
                  </p>
                </div>

                {/* Status */}
                <div className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                  settings.allowedClockInIps?.trim()
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}>
                  <Wifi size={16} className="mt-0.5 shrink-0" />
                  {settings.allowedClockInIps?.trim() ? (
                    <span>
                      IP restriction active — staff must be on the school Wi-Fi to clock in.
                    </span>
                  ) : (
                    <span>
                      No IPs configured — clock-in is allowed from any network. Add at least one IP to restrict to school Wi-Fi only.
                    </span>
                  )}
                </div>

                {/*
                  ── GPS Geofence (DISABLED — needs more work) ───────────────────────────
                  Location-based clock-in is currently disabled because GPS accuracy indoors
                  is too variable (5–50 m) and causes legitimate staff to be blocked.
                  The geofence infrastructure (STRICT/SOFT/OFF modes, radius) is preserved
                  in the backend and can be re-enabled once the pin accuracy issues are resolved.
                */}
                <div className="rounded-lg border border-gray-200 p-4 opacity-50 cursor-not-allowed select-none">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck size={16} className="text-gray-400" />
                    <span className="text-sm font-semibold text-gray-400">GPS Geofence (Coming Soon)</span>
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wide bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Disabled</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    GPS-based clock-in is paused while pin accuracy is improved.
                    Use the Wi-Fi IP restriction above in the meantime.
                  </p>
                  {/* GPS lat/lng display preserved for reference */}
                  {(settings.latitude || settings.longitude) && (
                    <div className="mt-2 text-[10px] text-gray-300 flex gap-3 font-mono">
                      <span className="bg-gray-50 px-2 py-0.5 rounded border border-gray-100">LAT: {settings.latitude}</span>
                      <span className="bg-gray-50 px-2 py-0.5 rounded border border-gray-100">LNG: {settings.longitude}</span>
                    </div>
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
                  <p className="text-[10px] text-gray-400 mt-1">Recommended: square 512x512px PNG (also used for the installed app)</p>
                </div>

                {/* PWA Logo */}
                <div className="text-center">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">PWA App Icon</label>
                  <div className="relative mx-auto mt-6 flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border-2 border-emerald-200 bg-emerald-50 shadow-inner">
                    <img src={previews.pwaLogo} alt="PWA App Icon copied from favicon on white" className="h-16 w-16 object-contain" onError={(e) => e.target.src = '/logo512.png'} />
                  </div>
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                    Uses Page Favicon
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400">Automatically resized for browser and app installation</p>
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
    </SettingsPageShell>
  );
};

export default SchoolSettings;
