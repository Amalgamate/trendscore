import React, { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  Building2,
  GraduationCap,
  Landmark,
  ShieldCheck,
  HelpCircle,
  ExternalLink,
  ArrowRight,
  CheckCircle,
  Clock3,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { authAPI, schoolAPI } from '../../services/api';
import { setBranchId, setSelectedInstitutionType } from '../../services/schoolContext';
import OTPVerificationForm from './OTPVerificationForm';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader } from "../ui/card";
import { cn } from "../../utils/cn";

// Helper: School fetching removed for single-tenant mode

const INSTITUTION_OPTIONS = [
  {
    value: 'PRIMARY_CBC',
    label: 'Primary CBC',
    subtitle: 'Junior School',
    description: 'Use CBC structure for lower and upper primary workflows.',
    range: 'PP1 - Grade 9',
    icon: Building2,
  },
  {
    value: 'SECONDARY',
    label: 'Secondary',
    subtitle: 'High School',
    description: 'Enable secondary classes, subjects, and reporting structure.',
    range: 'Form 1 - Form 4',
    icon: GraduationCap,
  },
  {
    value: 'TERTIARY',
    label: 'Tertiary',
    subtitle: 'College / University',
    description: 'Use tertiary departments, programs, and unit-based setup.',
    range: 'College / University',
    icon: Landmark,
  },
];

const safeHexColor = (value, fallback) =>
  /^#[0-9A-Fa-f]{6}$/.test(String(value || '')) ? value : fallback;

export default function LoginForm({ onSwitchToRegister, onSwitchToForgotPassword, onLoginSuccess, brandingSettings }) {
  const defaultSchoolProfile = {
    name: brandingSettings?.schoolName || brandingSettings?.name || '',
    motto: brandingSettings?.motto || '',
    phone: brandingSettings?.phone || '',
    email: brandingSettings?.email || '',
    address: brandingSettings?.address || '',
    vision: brandingSettings?.vision || '',
    mission: brandingSettings?.mission || '',
    primaryColor: brandingSettings?.primaryColor || '#030b82',
    secondaryColor: brandingSettings?.secondaryColor || '#0D9488',
    welcomeTitle: brandingSettings?.welcomeTitle || 'Welcome back!',
    welcomeMessage: brandingSettings?.welcomeMessage || 'Sign in to access your dashboard.',
    onboardingTitle: brandingSettings?.onboardingTitle || 'Join Our Community',
    onboardingMessage: brandingSettings?.onboardingMessage || 'Create an account to start managing your school today.',
  };
  const [formData, setFormData] = useState({ email: '', password: '', rememberMe: false });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [pendingUserData, setPendingUserData] = useState(null);
  const [showInstitutionSetupModal, setShowInstitutionSetupModal] = useState(false);
  const [institutionChoice, setInstitutionChoice] = useState('PRIMARY_CBC');
  const [pendingCredentialsData, setPendingCredentialsData] = useState(null);
  const [institutionSetupError, setInstitutionSetupError] = useState('');
  const [isLockingInstitution, setIsLockingInstitution] = useState(false);
  const [institutionSetupSuccess, setInstitutionSetupSuccess] = useState('');
  const [institutionSetupProgress, setInstitutionSetupProgress] = useState(null);
  const [isLoadingInstitutionSetupProgress, setIsLoadingInstitutionSetupProgress] = useState(false);
  const [wizardStep, setWizardStep] = useState('institution');
  const [schoolProfile, setSchoolProfile] = useState(defaultSchoolProfile);
  const skipOtp = import.meta.env.VITE_SKIP_OTP === 'true';
  const institutionOptionMap = useMemo(
    () => INSTITUTION_OPTIONS.reduce((acc, item) => ({ ...acc, [item.value]: item }), {}),
    []
  );

  const setupChecklist = useMemo(() => {
    const progressItems = institutionSetupProgress?.items;
    if (Array.isArray(progressItems) && progressItems.length > 0) {
      return progressItems.map((item) => [item.label, item.completed]);
    }
    return [
      ['Institution Type', wizardStep === 'profile' || !!institutionSetupSuccess],
      ['School Profile', !!institutionSetupSuccess],
    ];
  }, [institutionSetupProgress, wizardStep, institutionSetupSuccess]);

  const resolveInstitutionType = (email, apiUser) => {
    // Junior remains default. Only force SECONDARY for SS demo accounts.
    const normalized = String(email || apiUser?.email || '').toLowerCase();
    const isSsDemo = normalized === 'admin.ss@local.test' || normalized === 'teacher.ss@local.test';
    return apiUser?.institutionType || (isSsDemo ? 'SECONDARY' : 'PRIMARY_CBC');
  };

  // Show a banner if the user was redirected here because their session expired.
  const [sessionExpiredReason] = useState(() => {
    const flag = sessionStorage.getItem('session_expired');
    if (flag) sessionStorage.removeItem('session_expired');
    return flag || '';
  });

  useEffect(() => {
    let alive = true;
    const loadInstitutionProgress = async () => {
      if (!showInstitutionSetupModal || !pendingCredentialsData?.token || !institutionChoice) return;
      setIsLoadingInstitutionSetupProgress(true);
      try {
        const response = await schoolAPI.getInstitutionSetupProgress(institutionChoice, pendingCredentialsData.token);
        if (alive) {
          setInstitutionSetupProgress(response?.data || null);
        }
      } catch (_error) {
        if (alive) setInstitutionSetupProgress(null);
      } finally {
        if (alive) setIsLoadingInstitutionSetupProgress(false);
      }
    };

    loadInstitutionProgress();
    return () => {
      alive = false;
    };
  }, [showInstitutionSetupModal, pendingCredentialsData, institutionChoice]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Min 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const completeBypassLogin = async (credentialsData) => {
    const { token, refreshToken, user, mustChangePassword } = credentialsData;
    if (token) localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    if (formData.rememberMe) localStorage.setItem('authToken', token);

    const resolvedInstitutionType = resolveInstitutionType(formData.email, user);
    const loginUserData = {
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      roles: Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [user.role],
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      institutionType: resolvedInstitutionType,
      schoolId: null,
      branchId: user.branchId || user.branch?.id || null,
      school: user.school || null,
      branch: user.branch || null,
      mustChangePassword
    };

    const bid = user.branchId || user.branch?.id || '';
    if (bid) setBranchId(bid);
    setSelectedInstitutionType(resolvedInstitutionType);

    onLoginSuccess(loginUserData, token, refreshToken);
  };

  const handleInstitutionOptionClick = (value) => {
    setInstitutionChoice(value);
    setWizardStep('profile');
    setInstitutionSetupError('');
    setInstitutionSetupSuccess('');
    const label = institutionOptionMap[value]?.label || 'this institution type';
    toast.success(`Good choice. Now add the school details for ${label}.`);
  };

  const handleSchoolProfileChange = (e) => {
    const { name, value } = e.target;
    setSchoolProfile(prev => ({ ...prev, [name]: value }));
    if (institutionSetupError) setInstitutionSetupError('');
  };

  const validateSchoolProfile = () => {
    if (!schoolProfile.name.trim()) {
      return 'Please enter the school name. This is the name that will appear on reports and receipts.';
    }
    if (schoolProfile.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(schoolProfile.email.trim())) {
      return 'Please check the school email address. It should look like info@school.co.ke.';
    }
    return '';
  };

  const handleSaveSchoolProfile = async () => {
    if (!pendingCredentialsData?.user) return;

    const validationError = validateSchoolProfile();
    if (validationError) {
      setInstitutionSetupError(validationError);
      toast.error(validationError);
      return;
    }

    setInstitutionSetupError('');
    setIsLockingInstitution(true);
    const toastId = toast.loading('Saving the school profile...');

    try {
      const cleanProfile = Object.entries(schoolProfile).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'string' ? value.trim() : value;
        return acc;
      }, {});

      await schoolAPI.updateCurrent(cleanProfile, pendingCredentialsData.token);
      await schoolAPI.lockInstitutionType(institutionChoice, pendingCredentialsData.token);
      const progressResponse = await schoolAPI.getInstitutionSetupProgress(institutionChoice, pendingCredentialsData.token);

      const nextCredentialsData = {
        ...pendingCredentialsData,
        user: {
          ...pendingCredentialsData.user,
          institutionType: institutionChoice,
          institutionTypeLocked: true,
          requiresInstitutionSetup: false,
          school: {
            ...(pendingCredentialsData.user.school || {}),
            ...cleanProfile,
          },
        },
      };

      setPendingCredentialsData(nextCredentialsData);
      setInstitutionSetupProgress(progressResponse?.data || null);
      setInstitutionSetupSuccess('School profile saved. You can now continue to the dashboard.');
      toast.success('School profile saved. Reports, receipts, and the login page can now use these details.', { id: toastId });
    } catch (error) {
      const message = error?.message || 'We could not save the school profile. Please check the details and try again.';
      setInstitutionSetupError(message);
      toast.error(message, { id: toastId });
    } finally {
      setIsLockingInstitution(false);
    }
  };

  const handleContinueAfterInstitutionSetup = async () => {
    if (!pendingCredentialsData) return;
    setShowInstitutionSetupModal(false);
    setInstitutionSetupSuccess('');
    setInstitutionSetupError('');
    const credentials = pendingCredentialsData;
    setPendingCredentialsData(null);
    await completeBypassLogin(credentials);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const credentialsData = await authAPI.login({
        email: formData.email.trim(),
        password: formData.password,
      });

      const userRole = credentialsData?.user?.role;
      const shouldUseOtp = credentialsData?.requiresOtp !== false;
      const isStudent = userRole === 'STUDENT';
      const isSuperAdmin = userRole === 'SUPER_ADMIN';
      const shouldBypassOtp = skipOtp || !shouldUseOtp || isStudent || isSuperAdmin;

      if (userRole === 'SUPER_ADMIN' && credentialsData?.user?.requiresInstitutionSetup) {
        setPendingCredentialsData(credentialsData);
        setInstitutionChoice(credentialsData?.user?.institutionType || 'PRIMARY_CBC');
        setInstitutionSetupError('');
        setInstitutionSetupSuccess('');
        setInstitutionSetupProgress(null);
        setWizardStep('institution');
        setSchoolProfile(prev => ({
          ...prev,
          name: credentialsData?.user?.school?.name || prev.name,
          email: credentialsData?.user?.school?.email || prev.email,
          phone: credentialsData?.user?.school?.phone || prev.phone,
          address: credentialsData?.user?.school?.address || prev.address,
          motto: credentialsData?.user?.school?.motto || prev.motto,
        }));
        setShowInstitutionSetupModal(true);
        return;
      }

      if (shouldBypassOtp) {
        await completeBypassLogin(credentialsData);
        return;
      }

      // Trigger OTP flow

      try {
        await authAPI.sendOTP({ email: formData.email });
        setPendingUserData({
          email: formData.email,
          phone: credentialsData.user?.phone || credentialsData.user?.school?.phone || '+254XXXXXXXX',
          user: credentialsData.user,
          token: credentialsData.token,
          refreshToken: credentialsData.refreshToken,
          mustChangePassword: credentialsData.mustChangePassword,
          institutionType: resolveInstitutionType(formData.email, credentialsData.user),
        });
        setShowOTPVerification(true);
      } catch (otpError) {
        setErrors({ form: otpError.message || 'Failed to send OTP' });
      }
    } catch (error) {
      setErrors({ form: error.message || 'Authentication failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPVerifySuccess = async (userData) => {
    if (pendingUserData?.token) {
      localStorage.setItem('token', pendingUserData.token);
      if (pendingUserData.refreshToken) localStorage.setItem('refreshToken', pendingUserData.refreshToken);
      if (formData.rememberMe) localStorage.setItem('authToken', pendingUserData.token);
    }

    // Unified single-tenant mode
    let school = pendingUserData.user.school || null;

    const resolvedInstitutionType = pendingUserData.institutionType || resolveInstitutionType(pendingUserData.email, pendingUserData.user);
    const loginUserData = {
      email: pendingUserData.user.email,
      name: `${pendingUserData.user.firstName} ${pendingUserData.user.lastName}`,
      role: pendingUserData.user.role,
      roles: Array.isArray(pendingUserData.user.roles) && pendingUserData.user.roles.length > 0
        ? pendingUserData.user.roles
        : [pendingUserData.user.role],
      id: pendingUserData.user.id,
      firstName: pendingUserData.user.firstName,
      lastName: pendingUserData.user.lastName,
      institutionType: resolvedInstitutionType,
      schoolId: null,
      branchId: pendingUserData.user.branchId || pendingUserData.user.branch?.id || null,
      school: school,
      branch: pendingUserData.user.branch || null,
      mustChangePassword: pendingUserData.mustChangePassword
    };

    // setCurrentSchoolId removed for single-tenant mode
    const bid = pendingUserData.user.branchId || pendingUserData.user.branch?.id || '';
    if (bid) setBranchId(bid);
    setSelectedInstitutionType(resolvedInstitutionType);

    onLoginSuccess(loginUserData, pendingUserData.token, pendingUserData.refreshToken);
  };

  const handleBackToLogin = () => {
    setShowOTPVerification(false);
    setPendingUserData(null);
    setErrors({});
  };

  const loginBackgroundColor = brandingSettings?.primaryColor || 'var(--brand-primary)';

  return (
    <div
      className="w-full min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundColor: loginBackgroundColor
      }}
    >

      {sessionExpiredReason && (
        <div className="w-full max-w-sm mb-3 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-sm font-medium relative z-10">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          {sessionExpiredReason === 'forced_logout'
            ? 'You were signed out by an administrator. Please complete the required onboarding and sign in again.'
            : sessionExpiredReason === 'inactivity'
              ? 'You were signed out after 30 minutes of inactivity. Please sign in again.'
              : 'Your session has expired. Please sign in again.'}
        </div>
      )}

      <Card className="w-full max-w-sm border-white/20 bg-white/95 backdrop-blur-xl shadow-2xl relative z-10 animate-fade-up">
        <CardHeader className="pt-6 pb-2">
          <div className="text-center group">
            {brandingSettings?.logoUrl && (
              <img
                src={brandingSettings.logoUrl}
                alt="Logo"
                className="w-24 h-24 object-contain mx-auto transition-transform duration-500 group-hover:scale-110 drop-shadow-xl"
                onError={(e) => { e.currentTarget.src = '/branding/logo.png'; }}
              />
            )}
          </div>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          {/* Error Alert */}
          {errors.form && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3 text-red-700 animate-shake">
              <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div className="text-sm font-semibold">{errors.form}</div>
            </div>
          )}

          {showOTPVerification && pendingUserData ? (
            <OTPVerificationForm
              email={pendingUserData.email}
              phone={pendingUserData.phone}
              onVerifySuccess={handleOTPVerifySuccess}
              onBackToLogin={handleBackToLogin}
              brandingSettings={brandingSettings}
            />
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-semibold text-gray-900 leading-tight">
                  {brandingSettings?.welcomeTitle || 'Welcome Back!'}
                </h1>
                {brandingSettings?.welcomeMessage && (
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mt-2 px-4">
                    {brandingSettings.welcomeMessage}
                  </p>
                )}
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
              {/* Demo pills commented out as requested 
              <div className="flex flex-wrap gap-2 justify-center mb-2 pb-4 border-b border-gray-100">
                {DEMO_ACCOUNTS.map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleDemoClick(acc)}
                    className={`px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider rounded-full border transition-all duration-150 transform active:scale-95 ${acc.color}`}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 justify-center mb-2 pb-4 border-b border-gray-100">
                {SS_DEMO_ACCOUNTS.map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleDemoClick(acc)}
                    className={`px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider rounded-full border transition-all duration-150 transform active:scale-95 ${acc.color}`}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
              */}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium ml-1">Email</Label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={cn(
                    "h-12 border-gray-200 focus:border-brand-purple focus:ring-brand-purple/20",
                    errors.email && "border-red-500 bg-red-50"
                  )}
                  placeholder="you@school.com"
                  autoComplete="email"
                />
                {errors.email && <p className="text-red-600 text-[10px] font-medium uppercase ml-1">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
                  <button
                    type="button"
                    onClick={onSwitchToForgotPassword}
                    className="text-[10px] text-brand-purple hover:underline font-medium"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={cn(
                      "h-12 pr-12 border-gray-200 focus:border-brand-purple focus:ring-brand-purple/20",
                      errors.password && "border-red-500 bg-red-50"
                    )}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-purple transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-600 text-[10px] font-medium uppercase ml-1">{errors.password}</p>}
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 group cursor-pointer">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-gray-300 text-brand-purple focus:ring-brand-purple accent-brand-purple cursor-pointer transition-transform group-active:scale-90"
                  />
                  <span className="text-sm text-gray-600 font-medium transition-colors group-hover:text-gray-950">Remember me</span>
                </label>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-sm font-medium shadow-xl transition-all duration-300 transform active:scale-95 bg-brand-purple hover:bg-brand-purple/90"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </Button>

              <div className="pt-6 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-500 font-medium">
                  New?{' '}
                  <button
                    type="button"
                    onClick={onSwitchToRegister}
                    className="text-brand-purple hover:underline font-medium ml-1"
                  >
                    Create account
                  </button>
                </p>
              </div>
            </form>
            </>
          )}
        </CardContent>
      </Card>

      {showInstitutionSetupModal && (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="flex min-h-screen w-full flex-col overflow-y-auto lg:grid lg:grid-cols-[252px_minmax(0,1fr)] lg:overflow-hidden">
            <aside className="bg-[var(--brand-primary)] px-5 py-5 text-white lg:min-h-screen">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-white/10">
                  <Building2 size={18} />
                </div>
                <p className="text-lg font-semibold">TrendScore</p>
              </div>

              <div className="mt-5 border-t border-white/15 pt-5">
                <p className="text-xl font-semibold leading-tight">Welcome to TrendScore</p>
                <p className="mt-2 text-xs leading-5 text-white/75">
                  Set up the institution profile and confirm the structure this system will use.
                </p>
              </div>

              <div className="mt-5 border-t border-white/15 pt-5">
                <p className="text-[11px] font-semibold uppercase text-white/70">Setup Progress</p>
                <div className="mt-3 flex items-center gap-4">
                  <div
                    className="grid h-20 w-20 shrink-0 place-items-center rounded-full"
                    style={{
                      background: `conic-gradient(#7c3aed ${(institutionSetupProgress?.summary?.percent || 0) * 3.6}deg, rgba(255,255,255,0.14) 0deg)`,
                    }}
                  >
                    <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-[var(--brand-primary)]">
                      <div className="text-center">
                        <p className="text-xl font-bold">{institutionSetupProgress?.summary?.percent || 0}%</p>
                        <p className="text-[10px] text-white/75">Complete</p>
                      </div>
                    </div>
                  </div>
                  {institutionSetupProgress?.summary && (
                    <p className="text-xs font-semibold leading-5 text-emerald-200">
                      {institutionSetupProgress.summary.completed} of {institutionSetupProgress.summary.total} steps completed
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 hidden border-t border-white/15 pt-5 lg:block">
                <p className="text-[11px] font-semibold uppercase text-white/70">Setup Checklist</p>
                <div className="mt-3 space-y-2">
                  {setupChecklist.map(([label, done]) => (
                    <div key={label} className="flex items-center gap-2.5 text-xs">
                      <span className={cn(
                        "grid h-4 w-4 place-items-center rounded-full border",
                        done ? "border-emerald-300 bg-emerald-300 text-[var(--brand-primary)]" : "border-violet-300 text-violet-200"
                      )}>
                        {done ? <Check size={10} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      </span>
                      <span className={done ? 'text-white' : 'text-violet-200'}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 hidden rounded-md border border-white/15 bg-white/10 p-3 lg:block">
                <div className="flex items-start gap-2.5">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-400 text-white">
                    <HelpCircle size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">Need help?</p>
                    <p className="mt-1 text-[11px] leading-4 text-white/75">Check the setup guide or contact support.</p>
                  </div>
                  <ExternalLink size={13} className="ml-auto shrink-0 text-white/75" />
                </div>
              </div>
            </aside>

            <main className="flex min-h-screen flex-col bg-white px-4 py-4 sm:px-6 lg:h-screen lg:overflow-y-auto lg:px-8 lg:py-4 xl:px-10">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-semibold text-[var(--brand-primary)]">
                    {wizardStep === 'institution' ? 'Step 1 of 3' : 'Step 2 of 3'}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold leading-tight text-slate-950">
                    {wizardStep === 'institution' ? 'Select Institution Type' : 'Set Up School Profile'}
                  </h2>
                  <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-600">
                    {wizardStep === 'institution'
                      ? 'Choose the active institution for this system. After saving, this will be locked for data safety.'
                      : 'Add the details people will see on the login page, reports, receipts, and school records.'}
                  </p>
                </div>
                <div className="hidden items-center gap-2.5 text-right lg:flex">
                  <ShieldCheck className="h-7 w-7 text-[var(--brand-primary)]" />
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Your data is safe with us</p>
                    <p className="mt-1 text-xs text-slate-500">We follow strict security standards</p>
                  </div>
                </div>
              </div>

              {institutionSetupSuccess && (
                <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                  {institutionSetupSuccess}
                </div>
              )}

              {wizardStep === 'institution' ? (
                <>
                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    {INSTITUTION_OPTIONS.map((option) => {
                      const selected = institutionChoice === option.value;
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleInstitutionOptionClick(option.value)}
                          className={cn(
                            "relative min-h-[132px] rounded-md border bg-white p-4 text-center shadow-sm transition-all duration-150",
                            selected
                              ? "border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]/30"
                              : "border-slate-200 hover:border-[var(--brand-primary)]/50 hover:shadow-md"
                          )}
                        >
                          {selected && (
                            <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-[var(--brand-primary)] text-white">
                              <Check size={13} />
                            </span>
                          )}
                          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-violet-100 bg-violet-50 text-[var(--brand-primary)]">
                            <Icon size={21} />
                          </span>
                          <p className="mt-3 text-base font-bold text-slate-950">{option.label}</p>
                          <p className="mt-1 text-[11px] font-bold uppercase text-[var(--brand-primary)]">{option.subtitle}</p>
                          <p className="mx-auto mt-2 max-w-[230px] text-xs leading-4 text-slate-600">{option.description}</p>
                          <span className="mt-3 inline-flex min-h-[26px] items-center rounded-md bg-violet-50 px-3 text-xs font-medium text-[var(--brand-primary)]">
                            {option.range}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <section className="mt-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Institution Setup Readiness</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {isLoadingInstitutionSetupProgress
                            ? 'Checking current setup...'
                            : "You're almost there. Complete the remaining items to finish setup."}
                        </p>
                      </div>
                      {institutionSetupProgress?.summary && (
                        <p className="text-base font-bold text-[var(--brand-primary)]">
                          {institutionSetupProgress.summary.completed}/{institutionSetupProgress.summary.total}
                        </p>
                      )}
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[var(--brand-primary)] transition-all duration-300"
                        style={{ width: `${institutionSetupProgress?.summary?.percent || 0}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-[var(--brand-primary)]">
                      {institutionSetupProgress?.summary?.percent || 0}% complete
                    </p>
                    {!isLoadingInstitutionSetupProgress && Array.isArray(institutionSetupProgress?.items) && (
                      <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        {institutionSetupProgress.items.map((item) => (
                          <div key={item.key} className="flex min-h-[31px] items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-1.5">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className={cn(
                                "grid h-4 w-4 shrink-0 place-items-center rounded-full",
                                item.completed ? 'bg-emerald-600 text-white' : 'bg-amber-50 text-amber-600'
                              )}>
                                {item.completed ? <CheckCircle size={11} /> : <Clock3 size={11} />}
                              </span>
                              <p className="truncate text-xs font-medium text-slate-800">{item.label}</p>
                            </div>
                            <p className="shrink-0 text-xs font-bold text-slate-900">{item.current}/{item.target}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              ) : (
                <section className="mt-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">School Profile</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Selected: {institutionOptionMap[institutionChoice]?.label || institutionChoice}
                      </p>
                    </div>
                    <span className="rounded-md bg-violet-50 px-3 py-1 text-xs font-semibold text-[var(--brand-primary)]">
                      These details can be edited later
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="school-name" className="text-xs text-slate-700">School name *</Label>
                      <Input id="school-name" name="name" value={schoolProfile.name} onChange={handleSchoolProfileChange} className="h-9 text-sm" placeholder="Example Primary School" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="school-phone" className="text-xs text-slate-700">Phone number</Label>
                      <Input id="school-phone" name="phone" value={schoolProfile.phone} onChange={handleSchoolProfileChange} className="h-9 text-sm" placeholder="+254..." />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="school-email" className="text-xs text-slate-700">Email address</Label>
                      <Input id="school-email" name="email" value={schoolProfile.email} onChange={handleSchoolProfileChange} className="h-9 text-sm" placeholder="info@school.co.ke" />
                    </div>
                    <div className="space-y-1 md:col-span-2 xl:col-span-3">
                      <Label htmlFor="school-address" className="text-xs text-slate-700">Address</Label>
                      <Input id="school-address" name="address" value={schoolProfile.address} onChange={handleSchoolProfileChange} className="h-9 text-sm" placeholder="Town, county, or postal address" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="school-motto" className="text-xs text-slate-700">Motto</Label>
                      <Input id="school-motto" name="motto" value={schoolProfile.motto} onChange={handleSchoolProfileChange} className="h-9 text-sm" placeholder="A short school motto" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="primary-color" className="text-xs text-slate-700">Main colour</Label>
                      <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-2">
                        <input id="primary-color" type="color" name="primaryColor" value={safeHexColor(schoolProfile.primaryColor, '#030b82')} onChange={handleSchoolProfileChange} className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0" />
                        <Input name="primaryColor" value={schoolProfile.primaryColor} onChange={handleSchoolProfileChange} className="h-7 border-0 px-1 text-xs shadow-none focus-visible:ring-0" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="secondary-color" className="text-xs text-slate-700">Second colour</Label>
                      <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-2">
                        <input id="secondary-color" type="color" name="secondaryColor" value={safeHexColor(schoolProfile.secondaryColor, '#0D9488')} onChange={handleSchoolProfileChange} className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0" />
                        <Input name="secondaryColor" value={schoolProfile.secondaryColor} onChange={handleSchoolProfileChange} className="h-7 border-0 px-1 text-xs shadow-none focus-visible:ring-0" />
                      </div>
                    </div>
                    <div className="space-y-1 md:col-span-1 xl:col-span-1">
                      <Label htmlFor="school-vision" className="text-xs text-slate-700">Vision</Label>
                      <textarea id="school-vision" name="vision" value={schoolProfile.vision} onChange={handleSchoolProfileChange} className="min-h-[70px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]" placeholder="What the school aims to become" />
                    </div>
                    <div className="space-y-1 md:col-span-1 xl:col-span-1">
                      <Label htmlFor="school-mission" className="text-xs text-slate-700">Mission</Label>
                      <textarea id="school-mission" name="mission" value={schoolProfile.mission} onChange={handleSchoolProfileChange} className="min-h-[70px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]" placeholder="What the school does every day" />
                    </div>
                    <div className="space-y-1 md:col-span-2 xl:col-span-1">
                      <Label htmlFor="welcome-title" className="text-xs text-slate-700">Login welcome title</Label>
                      <Input id="welcome-title" name="welcomeTitle" value={schoolProfile.welcomeTitle} onChange={handleSchoolProfileChange} className="h-9 text-sm" placeholder="Welcome back!" />
                      <textarea name="welcomeMessage" value={schoolProfile.welcomeMessage} onChange={handleSchoolProfileChange} className="mt-2 min-h-[34px] w-full rounded-md border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[var(--brand-primary)]" placeholder="Short welcome message" />
                    </div>
                  </div>
                </section>
              )}

              {institutionSetupError && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {institutionSetupError}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 border-gray-300 px-5 text-sm text-black"
                  onClick={() => {
                    setShowInstitutionSetupModal(false);
                    setPendingCredentialsData(null);
                    setInstitutionSetupError('');
                    setInstitutionSetupSuccess('');
                    setWizardStep('institution');
                  }}
                  disabled={isLockingInstitution}
                >
                  Cancel Setup
                </Button>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 border-gray-300 px-7 text-sm text-black"
                    disabled={isLockingInstitution || wizardStep === 'institution'}
                    onClick={() => {
                      setWizardStep('institution');
                      setInstitutionSetupError('');
                      setInstitutionSetupSuccess('');
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    className="h-9 min-w-[140px] bg-[var(--brand-primary)] px-7 text-sm text-white hover:brightness-90"
                    onClick={
                      institutionSetupSuccess
                        ? handleContinueAfterInstitutionSetup
                        : wizardStep === 'institution'
                          ? () => handleInstitutionOptionClick(institutionChoice)
                          : handleSaveSchoolProfile
                    }
                    disabled={isLockingInstitution}
                  >
                    <span>{isLockingInstitution ? 'Saving...' : institutionSetupSuccess ? 'Continue to Dashboard' : wizardStep === 'institution' ? 'Next' : 'Save & Continue'}</span>
                    {!isLockingInstitution && <ArrowRight size={16} className="ml-2" />}
                  </Button>
                </div>
              </div>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
