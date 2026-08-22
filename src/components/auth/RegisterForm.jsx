import React, { useEffect, useMemo, useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, CheckCircle, Loader2, XCircle, Building2, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { onboardingAPI, authAPI } from '../../services/api';
import { PRODUCT_DISPLAY_NAME } from '../../config/productIdentity';
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { cn } from "../../utils/cn";
import MpesaOnboardingChecklist from '../payments/MpesaOnboardingChecklist';

export default function RegisterForm({ onSwitchToLogin, onRegisterSuccess, brandingSettings }) {
  const [countryCode, setCountryCode] = useState('+254'); // Default to Kenya
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    schoolName: '',
    schoolType: '', // Default empty
    address: '',
    county: '',
    subCounty: '',
    ward: '',
    termsAccepted: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // validationStatus: { [field]: 'valid' | 'invalid' | 'loading' | null }
  const [fieldStatus, setFieldStatus] = useState({});
  const checkAvailability = useMemo(() => {
    let timeoutId = null;

    const runCheck = async (field, value) => {
      if (!value) return;

      // Regex pre-check
      if (field === 'email' && !/\S+@\S+\.\S+/.test(value)) return;
      if (field === 'phone' && !/^\+?[0-9]{10,15}$/.test(value)) return;

      setFieldStatus(prev => ({ ...prev, [field]: 'loading' }));

      try {
        const result = await authAPI.checkAvailability({ [field]: value });
        if (result?.available === false) {
          const msg = `${field === 'email' ? 'Email' : 'Phone'} already exists`;
          setFieldStatus(prev => ({ ...prev, [field]: 'invalid' }));
          setErrors(prev => ({ ...prev, [field]: msg }));
          return;
        }
        setFieldStatus(prev => ({ ...prev, [field]: 'valid' }));
        setErrors(prev => ({ ...prev, [field]: '' }));
      } catch (error) {
        const msg = error.response?.data?.message || `${field === 'email' ? 'Email' : 'Phone'} already exists`;
        setFieldStatus(prev => ({ ...prev, [field]: 'invalid' }));
        setErrors(prev => ({ ...prev, [field]: msg }));
      } finally {
      }
    };

    const debounced = (field, value) => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        runCheck(field, value);
      }, 500);
    };

    debounced.cancel = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    return debounced;
  }, []);

  useEffect(() => () => {
    checkAvailability.cancel();
  }, [checkAvailability]);

  // Update field status immediately for synchronous validations
  const updateFieldStatus = (name, value) => {
    if (name === 'fullName') {
      setFieldStatus(prev => ({ ...prev, [name]: value.length > 3 ? 'valid' : null }));
    }
    if (name === 'schoolName') {
      setFieldStatus(prev => ({ ...prev, [name]: value.length > 3 ? 'valid' : null }));
    }
    if (name === 'password') {
      const isStrong = value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
      setFieldStatus(prev => ({ ...prev, [name]: isStrong ? 'valid' : null }));
    }
    if (name === 'confirmPassword') {
      setFieldStatus(prev => ({ ...prev, [name]: value === formData.password && value ? 'valid' : null }));
    }

    // Trigger async check for email/phone
    if (name === 'email' || name === 'phone') {
      if (name === 'email' && !/\S+@\S+\.\S+/.test(value)) {
        setFieldStatus(prev => ({ ...prev, [name]: 'invalid' }));
        return;
      }
      if (name === 'phone') {
        const fullPhone = countryCode + phoneNumber;
        if (fullPhone.length >= 10) checkAvailability('phone', fullPhone);
      } else {
        checkAvailability(name, value);
      }
    }
  };

  // African country codes
  const africanCountries = [
    { code: '+254', country: 'Kenya', flag: '🇰🇪', length: 9 },
    { code: '+255', country: 'Tanzania', flag: '🇹🇿', length: 9 },
    { code: '+256', country: 'Uganda', flag: '🇺🇬', length: 9 },
    { code: '+250', country: 'Rwanda', flag: '🇷🇼', length: 9 },
    { code: '+257', country: 'Burundi', flag: '🇧🇮', length: 8 },
    { code: '+251', country: 'Ethiopia', flag: '🇪🇹', length: 9 },
    { code: '+252', country: 'Somalia', flag: '🇸🇴', length: 8 },
    { code: '+211', country: 'South Sudan', flag: '🇸🇸', length: 9 },
    { code: '+27', country: 'South Africa', flag: '🇿🇦', length: 9 },
    { code: '+234', country: 'Nigeria', flag: '🇳🇬', length: 10 },
    { code: '+233', country: 'Ghana', flag: '🇬🇭', length: 9 },
    { code: '+20', country: 'Egypt', flag: '🇪🇬', length: 10 },
    { code: '+212', country: 'Morocco', flag: '🇲🇦', length: 9 },
    { code: '+213', country: 'Algeria', flag: '🇩🇿', length: 9 },
    { code: '+216', country: 'Tunisia', flag: '🇹🇳', length: 8 },
    { code: '+218', country: 'Libya', flag: '🇱🇾', length: 9 },
    { code: '+221', country: 'Senegal', flag: '🇸🇳', length: 9 },
    { code: '+225', country: 'Ivory Coast', flag: '🇨🇮', length: 10 },
    { code: '+226', country: 'Burkina Faso', flag: '🇧🇫', length: 8 },
    { code: '+227', country: 'Niger', flag: '🇳🇪', length: 8 },
    { code: '+228', country: 'Togo', flag: '🇹🇬', length: 8 },
    { code: '+229', country: 'Benin', flag: '🇧🇯', length: 8 },
    { code: '+230', country: 'Mauritius', flag: '🇲🇺', length: 8 },
    { code: '+231', country: 'Liberia', flag: '🇱🇷', length: 9 },
    { code: '+232', country: 'Sierra Leone', flag: '🇸🇱', length: 8 },
    { code: '+235', country: 'Chad', flag: '🇹🇩', length: 8 },
    { code: '+236', country: 'CAR', flag: '🇨🇫', length: 8 },
    { code: '+237', country: 'Cameroon', flag: '🇨🇲', length: 9 },
    { code: '+238', country: 'Cape Verde', flag: '🇨🇻', length: 7 },
    { code: '+240', country: 'Eq. Guinea', flag: '🇬🇶', length: 9 },
    { code: '+241', country: 'Gabon', flag: '🇬🇦', length: 7 },
    { code: '+242', country: 'Congo', flag: '🇨🇬', length: 9 },
    { code: '+243', country: 'DR Congo', flag: '🇨🇩', length: 9 },
    { code: '+244', country: 'Angola', flag: '🇦🇴', length: 9 },
    { code: '+245', country: 'Guinea-Bissau', flag: '🇬🇼', length: 7 },
    { code: '+248', country: 'Seychelles', flag: '🇸🇨', length: 7 },
    { code: '+249', country: 'Sudan', flag: '🇸🇩', length: 9 },
    { code: '+260', country: 'Zambia', flag: '🇿🇲', length: 9 },
    { code: '+261', country: 'Madagascar', flag: '🇲🇬', length: 9 },
    { code: '+262', country: 'Réunion', flag: '🇷🇪', length: 9 },
    { code: '+263', country: 'Zimbabwe', flag: '🇿🇼', length: 9 },
    { code: '+264', country: 'Namibia', flag: '🇳🇦', length: 9 },
    { code: '+265', country: 'Malawi', flag: '🇲🇼', length: 9 },
    { code: '+266', country: 'Lesotho', flag: '🇱🇸', length: 8 },
    { code: '+267', country: 'Botswana', flag: '🇧🇼', length: 8 },
    { code: '+268', country: 'Eswatini', flag: '🇸🇿', length: 8 },
    { code: '+269', country: 'Comoros', flag: '🇰🇲', length: 7 },
  ];

  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, label: '', color: '' };

    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    const levels = [
      { strength: 1, label: 'Weak', color: 'bg-red-500' },
      { strength: 2, label: 'Fair', color: 'bg-yellow-500' },
      { strength: 3, label: 'Good', color: 'bg-brand-teal' },
      { strength: 4, label: 'Strong', color: 'bg-green-500' }
    ];

    return levels.find(l => l.strength === strength) || levels[0];
  };

  const validateForm = () => {
    const newErrors = {};

    // Personal
    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    // Phone
    const selectedCountry = africanCountries.find(c => c.code === countryCode);
    if (!phoneNumber.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d+$/.test(phoneNumber)) {
      newErrors.phone = 'Please enter only numbers';
    } else if (selectedCountry && phoneNumber.length !== selectedCountry.length) {
      newErrors.phone = `Phone number should be ${selectedCountry.length} digits for ${selectedCountry.country}`;
    }

    // Password
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must include an uppercase letter';
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = 'Password must include a lowercase letter';
    } else if (!/\d/.test(formData.password)) {
      newErrors.password = 'Password must include a number';
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // School
    if (!formData.schoolName.trim()) newErrors.schoolName = 'School name is required';
    if (!formData.schoolType) newErrors.schoolType = 'School type is required';
    if (!formData.county) newErrors.county = 'County is required';
    if (!formData.address.trim()) newErrors.address = 'Physical address is required';
    if (!formData.termsAccepted) newErrors.termsAccepted = 'You must accept the terms and conditions';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Kenya county coordinates
  const kenyaCounties = {
    'Baringo': { bounds: [[0.05, 35.26], [1.27, 36.47]] },
    'Bomet': { bounds: [[-0.68, 34.7], [0.42, 35.33]] },
    'Bungoma': { bounds: [[0.25, 34.33], [1.38, 35.45]] },
    'Busia': { bounds: [[0.18, 33.89], [0.63, 34.38]] },
    'Elgeyo-Marakwet': { bounds: [[0.52, 35.15], [1.45, 35.98]] },
    'Garissa': { bounds: [[-0.47, 39.18], [2.1, 41.58]] },
    'Homa Bay': { bounds: [[-0.7, 33.94], [0.18, 34.88]] },
    'Isiolo': { bounds: [[0.35, 36.66], [2.27, 37.99]] },
    'Kajiado': { bounds: [[-2.77, 36.53], [-1.05, 37.29]] },
    'Kakamega': { bounds: [[0.22, 34.83], [0.93, 35.45]] },
    'Kericho': { bounds: [[-0.37, 35.27], [0.39, 35.83]] },
    'Kiambu': { bounds: [[-1.04, 36.65], [-0.59, 37.25]] },
    'Kilifi': { bounds: [[-3.64, 39.35], [-2.62, 40.32]] },
    'Kirinyaga': { bounds: [[-0.67, 37.32], [-0.07, 37.95]] },
    'Kisii': { bounds: [[-0.98, 34.78], [-0.56, 35.31]] },
    'Kitui': { bounds: [[-1.24, 37.86], [0.19, 39.03]] },
    'Kwale': { bounds: [[-4.68, 39.35], [-3.6, 40.55]] },
    'Laikipia': { bounds: [[-0.68, 36.63], [0.84, 37.37]] },
    'Lamu': { bounds: [[-2.62, 40.89], [-1.67, 41.94]] },
    'Machakos': { bounds: [[-2.22, 37.27], [-1.27, 38.32]] },
    'Makueni': { bounds: [[-3.29, 37.36], [-2.28, 38.48]] },
    'Mandera': { bounds: [[2.27, 40.31], [4.7, 41.58]] },
    'Marsabit': { bounds: [[2.18, 37.09], [4.43, 38.33]] },
    'Meru': { bounds: [[-1.32, 37.4], [0.68, 38.42]] },
    'Migori': { bounds: [[-1.73, 33.95], [-0.9, 34.65]] },
    'Murang\'a': { bounds: [[-1.08, 36.98], [-0.36, 37.46]] },
    'Nandi': { bounds: [[0.14, 34.89], [0.82, 35.45]] },
    'Narok': { bounds: [[-1.99, 35.3], [-0.74, 36.13]] },
    'Nyamira': { bounds: [[-0.81, 34.43], [-0.56, 34.98]] },
    'Nyandarua': { bounds: [[-0.73, 36.71], [-0.15, 37.09]] },
    'Nyeri': { bounds: [[-0.73, 36.98], [-0.21, 37.41]] },
    'Samburu': { bounds: [[0.73, 36.52], [2.27, 37.99]] },
    'Siaya': { bounds: [[-0.15, 33.94], [0.6, 34.57]] },
    'Taita-Taveta': { bounds: [[-3.99, 37.69], [-3.1, 38.9]] },
    'Tana River': { bounds: [[-2.62, 39.35], [-1.67, 40.89]] },
    'Tharaka-Nithi': { bounds: [[-0.35, 37.82], [0.43, 38.52]] },
    'Trans Nzoia': { bounds: [[0.82, 34.72], [1.52, 35.32]] },
    'Turkana': { bounds: [[1.27, 34.49], [3.91, 36.47]] },
    'Uasin Gishu': { bounds: [[0.21, 34.71], [1.14, 35.45]] },
    'Vihiga': { bounds: [[0.47, 34.72], [0.76, 35.05]] },
    'Wajir': { bounds: [[1.58, 40.05], [3.91, 41.58]] },
    'West Pokot': { bounds: [[1.14, 34.8], [2.33, 35.96]] }
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowErrors(true);
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Must combine phone before sending if not already done
      const fullPhone = countryCode + phoneNumber;

      const requestBody = {
        fullName: formData.fullName,
        email: formData.email,
        phone: fullPhone,
        password: formData.password,
        passwordConfirm: formData.confirmPassword,
        schoolName: formData.schoolName,
        schoolType: formData.schoolType,
        address: formData.address,
        county: formData.county,
        subCounty: formData.subCounty,
        ward: formData.ward,
      };

      const data = await onboardingAPI.registerFull(requestBody);
      if (data?.success && data?.data?.user) {
        toast.success('Registration successful! Verify your phone to continue.');
        setTimeout(() => {
          onRegisterSuccess({
            email: data.data.user.email,
            phone: data.data.user.phone,
            name: `${data.data.user.firstName} ${data.data.user.lastName}`,
            role: data.data.user.role,
          });
        }, 600);
      } else {
        const errorMessage = data?.error || data?.message || 'Registration failed';
        toast.error(errorMessage);
        if (errorMessage.toLowerCase().includes('phone')) setErrors({ phone: errorMessage });
        else if (errorMessage.toLowerCase().includes('email')) setErrors({ email: errorMessage });
        else setErrors({ form: errorMessage });
      }
    } catch (error) {
      let errorMsg = 'Unable to connect to server.';
      if (error.response?.data?.error) errorMsg = error.response.data.error;
      toast.error(errorMsg);
      setErrors({ email: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setPhoneNumber(value);
    if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
    if (value.length >= 9) updateFieldStatus('phone', countryCode + value);
  };

  const handleCountryCodeChange = (e) => {
    setCountryCode(e.target.value);
    if (phoneNumber.length >= 9) updateFieldStatus('phone', e.target.value + phoneNumber);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    updateFieldStatus(name, value);
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const brandColor = brandingSettings?.brandColor || 'var(--brand-purple)';

  return (
    <div
      className="w-full min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd, ${brandColor}bb)`
      }}
    >
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-black/10 rounded-full blur-3xl" />

      <Card className="w-full max-w-5xl border-white/20 bg-white/95 backdrop-blur-xl shadow-2xl relative z-10 animate-fade-up overflow-hidden">
        <CardHeader className="pt-10 pb-6 text-center border-b border-gray-100/50">
          <div className="inline-flex flex-col items-center justify-center transform scale-90 mb-2 group">
            {brandingSettings?.logoUrl && (
              <img
                src={brandingSettings.logoUrl}
                alt="Logo"
                className="w-24 h-24 object-contain mb-4 transition-transform duration-500 group-hover:scale-110 drop-shadow-xl"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <CardTitle className="text-xl md:text-2xl font-semibold tracking-tighter text-gray-900 uppercase">
                {brandingSettings?.schoolName || PRODUCT_DISPLAY_NAME}
            </CardTitle>
          </div>
          <CardTitle className="text-2xl font-medium text-gray-900 mt-2">
            {brandingSettings?.onboardingTitle || 'Create Account'}
          </CardTitle>
          <CardDescription className="text-gray-500 font-medium uppercase tracking-tight text-xs mt-1">
            {brandingSettings?.onboardingMessage || 'Join our modern school management community'}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <form onSubmit={handleSubmit} className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* Left Column: Personal & Security */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <div className="h-[1px] w-8 bg-gray-200" />
                    Personal Details
                  </h3>
                  <div className="space-y-5">
                    {/* Name */}
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-gray-700 font-medium ml-1">Full Name</Label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-purple transition-colors">
                          <User size={18} />
                        </div>
                        <Input
                          id="fullName"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleChange}
                          className={cn(
                            "h-12 pl-12 pr-12 border-gray-200 focus:border-brand-purple focus:ring-brand-purple/20 transition-all",
                            (fieldStatus.fullName === 'invalid' || (showErrors && errors.fullName)) && "border-red-500 bg-red-50"
                          )}
                          placeholder="John Doe"
                        />
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                          {fieldStatus.fullName === 'valid' && <CheckCircle className="h-5 w-5 text-green-500 animate-in fade-in zoom-in" />}
                        </div>
                      </div>
                      {showErrors && errors.fullName && <p className="text-[10px] text-red-600 font-medium uppercase ml-1">{errors.fullName}</p>}
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-700 font-medium ml-1">Email Address</Label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-purple transition-colors">
                          <Mail size={18} />
                        </div>
                        <Input
                          id="email"
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className={cn(
                            "h-12 pl-12 pr-12 border-gray-200 focus:border-brand-purple focus:ring-brand-purple/20 transition-all",
                            (fieldStatus.email === 'invalid' || (showErrors && errors.email)) && "border-red-500 bg-red-50"
                          )}
                          placeholder="you@school.com"
                        />
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                          {fieldStatus.email === 'loading' && <Loader2 className="animate-spin h-5 w-5 text-gray-400" />}
                          {fieldStatus.email === 'valid' && <CheckCircle className="h-5 w-5 text-green-500 animate-in fade-in zoom-in" />}
                          {fieldStatus.email === 'invalid' && <XCircle className="h-5 w-5 text-red-500 animate-in fade-in zoom-in" />}
                        </div>
                      </div>
                      {showErrors && errors.email && <p className="text-[10px] text-red-600 font-medium uppercase ml-1">{errors.email}</p>}
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                      <Label className="text-gray-700 font-medium ml-1">Mobile Number</Label>
                      <div className="flex gap-2">
                        <select
                          value={countryCode}
                          onChange={handleCountryCodeChange}
                          className="w-28 h-12 px-3 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple outline-none bg-white font-medium transition-all"
                        >
                          {africanCountries.map(country => (
                            <option key={country.code} value={country.code}>
                              {country.flag} {country.code}
                            </option>
                          ))}
                        </select>
                        <div className="relative flex-1 group">
                          <Input
                            type="tel"
                            value={phoneNumber}
                            onChange={handlePhoneChange}
                            className={cn(
                              "h-12 border-gray-200 focus:border-brand-purple focus:ring-brand-purple/20 transition-all",
                              errors.phone && "border-red-500 bg-red-50"
                            )}
                            placeholder="712345678"
                          />
                          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                            {fieldStatus.phone === 'loading' && <Loader2 className="animate-spin h-5 w-5 text-gray-400" />}
                            {fieldStatus.phone === 'valid' && <CheckCircle className="h-5 w-5 text-green-500 animate-in fade-in zoom-in" />}
                          </div>
                        </div>
                      </div>
                      {showErrors && errors.phone && <p className="text-[10px] text-red-600 font-medium uppercase ml-1">{errors.phone}</p>}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <div className="h-[1px] w-8 bg-gray-200" />
                    Security
                  </h3>
                  <div className="space-y-5">
                    {/* Password */}
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-gray-700 font-medium ml-1">Password</Label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-purple transition-colors">
                          <Lock size={18} />
                        </div>
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          className={cn(
                            "h-12 pl-12 pr-12 border-gray-200 focus:border-brand-purple focus:ring-brand-purple/20 transition-all",
                            (showErrors && errors.password) && "border-red-500 bg-red-50"
                          )}
                          placeholder="Min. 8 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-brand-purple transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {/* Strength meter */}
                      <div className="mt-2 px-1">
                        {formData.password && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center px-0.5">
                              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Strength: {passwordStrength.label}</span>
                            </div>
                            <div className="flex gap-1 h-1.5">
                              {[1, 2, 3, 4].map((step) => (
                                <div
                                  key={step}
                                  className={cn(
                                    "flex-1 rounded-full transition-all duration-500",
                                    step <= passwordStrength.strength ? passwordStrength.color : "bg-gray-100"
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {showErrors && errors.password && <p className="text-[10px] text-red-600 font-medium uppercase ml-1">{errors.password}</p>}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-gray-700 font-medium ml-1">Confirm Password</Label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-purple transition-colors">
                          <Lock size={18} />
                        </div>
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className={cn(
                            "h-12 pl-12 pr-12 border-gray-200 focus:border-brand-purple focus:ring-brand-purple/20 transition-all",
                            (showErrors && errors.confirmPassword) && "border-red-500 bg-red-50"
                          )}
                          placeholder="Repeat password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-brand-purple transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {showErrors && errors.confirmPassword && <p className="text-[10px] text-red-600 font-medium uppercase ml-1">{errors.confirmPassword}</p>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: School & Location */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <div className="h-[1px] w-8 bg-gray-200" />
                    School Details
                  </h3>
                  <div className="space-y-5">
                    {/* School Name */}
                    <div className="space-y-2">
                      <Label htmlFor="schoolName" className="text-gray-700 font-medium ml-1">School Name</Label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-purple transition-colors">
                          <Building2 size={18} />
                        </div>
                        <Input
                          id="schoolName"
                          name="schoolName"
                          value={formData.schoolName}
                          onChange={handleChange}
                          className={cn(
                            "h-12 pl-12 pr-12 border-gray-200 focus:border-brand-purple focus:ring-brand-purple/20 transition-all",
                            (fieldStatus.schoolName === 'invalid' || (showErrors && errors.schoolName)) && "border-red-500 bg-red-50"
                          )}
                          placeholder="School Name"
                        />
                      </div>
                      {showErrors && errors.schoolName && <p className="text-[10px] text-red-600 font-medium uppercase ml-1">{errors.schoolName}</p>}
                    </div>

                    {/* School Type */}
                    <div className="space-y-2">
                      <Label htmlFor="schoolType" className="text-gray-700 font-medium ml-1">School Type</Label>
                      <select
                        id="schoolType"
                        name="schoolType"
                        value={formData.schoolType}
                        onChange={handleChange}
                        className={cn(
                          "w-full h-12 px-4 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple outline-none bg-white font-medium transition-all",
                          (showErrors && errors.schoolType) && "border-red-500 bg-red-50"
                        )}
                      >
                        <option value="">Select Type</option>
                        <option>Public Primary</option>
                        <option>Public Secondary</option>
                        <option>Private Primary</option>
                        <option>Private Secondary</option>
                      </select>
                      {showErrors && errors.schoolType && <p className="text-[10px] text-red-600 font-medium uppercase ml-1">{errors.schoolType}</p>}
                    </div>

                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <div className="h-[1px] w-8 bg-gray-200" />
                    Location
                  </h3>
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="county" className="text-gray-700 font-medium ml-1">County</Label>
                        <select
                          id="county"
                          name="county"
                          value={formData.county}
                          onChange={handleChange}
                          className={cn(
                            "w-full h-12 px-4 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple outline-none bg-white font-medium transition-all",
                            (showErrors && errors.county) && "border-red-500 bg-red-50"
                          )}
                        >
                          <option value="">Select County</option>
                          {Object.keys(kenyaCounties).sort().map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subCounty" className="text-gray-700 font-medium ml-1">Sub-County</Label>
                        <Input
                          id="subCounty"
                          type="text"
                          name="subCounty"
                          value={formData.subCounty}
                          onChange={handleChange}
                          className="h-12 border-gray-200 focus:border-brand-purple focus:ring-brand-purple/20 transition-all font-medium"
                          placeholder="e.g. Westlands"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-gray-700 font-medium ml-1">Physical Address</Label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-purple transition-colors">
                          <MapPin size={18} />
                        </div>
                        <Input
                          id="address"
                          type="text"
                          name="address"
                          value={formData.address}
                          onChange={handleChange}
                          className={cn(
                            "h-12 pl-12 border-gray-200 focus:border-brand-purple focus:ring-brand-purple/20 transition-all font-medium",
                            (showErrors && errors.address) && "border-red-500 bg-red-50"
                          )}
                          placeholder="Street, Road, or Landmark"
                        />
                      </div>
                      {showErrors && errors.address && <p className="text-[10px] text-red-600 font-medium uppercase ml-1">{errors.address}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms & Submit */}
            <div className="mt-12 pt-10 border-t border-gray-100/50">
              <div className="mb-8">
                <MpesaOnboardingChecklist compact />
              </div>
              <div className="flex items-center justify-center mb-10 group">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <Checkbox
                    id="terms"
                    name="termsAccepted"
                    checked={formData.termsAccepted}
                    onChange={handleChange}
                    className="w-5 h-5 rounded border-gray-300 text-brand-purple focus:ring-brand-purple accent-brand-purple cursor-pointer transition-transform group-active:scale-95"
                  />
                  <span className="text-sm text-gray-600 font-medium group-hover:text-gray-900 transition-colors">
                    I agree to the <button type="button" className="text-brand-purple hover:underline underline-offset-4">Terms of Service</button> & <button type="button" className="text-brand-purple hover:underline underline-offset-4">Privacy Policy</button>
                  </span>
                </label>
              </div>
              {showErrors && errors.termsAccepted && <p className="text-[10px] text-red-600 font-medium uppercase text-center -mt-6 mb-6 animate-shake">{errors.termsAccepted}</p>}

              <div className="flex flex-col items-center gap-8">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full max-w-md h-14 text-sm font-semibold uppercase tracking-[0.2em] shadow-2xl transition-all duration-300 transform active:scale-[0.98] bg-brand-purple hover:bg-brand-purple/90 group"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>Create Account</span>
                      <CheckCircle className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-1 group-hover:translate-x-0" />
                    </div>
                  )}
                </Button>

                <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={onSwitchToLogin}
                    className="text-brand-purple hover:underline font-semibold ml-2"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
