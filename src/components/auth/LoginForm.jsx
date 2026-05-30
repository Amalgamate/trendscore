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

export default function LoginForm({ onSwitchToRegister, onSwitchToForgotPassword, onLoginSuccess, brandingSettings }) {
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
  const skipOtp = import.meta.env.VITE_SKIP_OTP === 'true';
  const institutionOptionMap = useMemo(
    () => INSTITUTION_OPTIONS.reduce((acc, item) => ({ ...acc, [item.value]: item }), {}),
    []
  );

  const resolveInstitutionType = (email, apiUser) => {
    // Junior remains default. Only force SECONDARY for SS demo accounts.
    const normalized = String(email || apiUser?.email || '').toLowerCase();
    const isSsDemo = normalized === 'admin.ss@local.test' || normalized === 'teacher.ss@local.test';
    return apiUser?.institutionType || (isSsDemo ? 'SECONDARY' : 'PRIMARY_CBC');
  };

  // Show a banner if the user was redirected here because their session expired.
  const [sessionExpired] = useState(() => {
    const flag = sessionStorage.getItem('session_expired');
    if (flag) sessionStorage.removeItem('session_expired');
    return !!flag;
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
      activeApps: Array.isArray(user.activeApps) ? user.activeApps : [],
      mustChangePassword
    };

    const bid = user.branchId || user.branch?.id || '';
    if (bid) setBranchId(bid);
    setSelectedInstitutionType(resolvedInstitutionType);

    onLoginSuccess(loginUserData, token, refreshToken);
  };

  const handleConfirmInstitutionSetup = async () => {
    if (!pendingCredentialsData?.user) return;
    setInstitutionSetupError('');
    setIsLockingInstitution(true);
    try {
      await schoolAPI.lockInstitutionType(institutionChoice);
      const nextCredentialsData = {
        ...pendingCredentialsData,
        user: {
          ...pendingCredentialsData.user,
          institutionType: institutionChoice,
          institutionTypeLocked: true,
          requiresInstitutionSetup: false,
        },
      };
      setPendingCredentialsData(nextCredentialsData);
      setInstitutionSetupSuccess(`Institution type "${institutionOptionMap[institutionChoice]?.label || institutionChoice}" configured successfully.`);
    } catch (error) {
      setInstitutionSetupError(error?.message || 'Failed to lock institution type. Please try again.');
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
      activeApps: Array.isArray(pendingUserData.user.activeApps) ? pendingUserData.user.activeApps : [],
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

      {sessionExpired && (
        <div className="w-full max-w-sm mb-3 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-sm font-medium relative z-10">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          Your session has expired. Please sign in again.
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
          <div className="flex min-h-screen w-full flex-col overflow-y-auto lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:overflow-hidden">
            <aside className="bg-[var(--brand-primary)] px-6 py-6 text-white lg:min-h-screen lg:px-7">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                  <Building2 size={20} />
                </div>
                <p className="text-xl font-semibold">TrendScore</p>
              </div>

              <div className="mt-7 border-t border-white/15 pt-7">
                <p className="text-2xl font-semibold leading-tight">Welcome to TrendScore</p>
                <p className="mt-3 text-sm leading-6 text-white/75">
                  Set up the institution profile and confirm the structure this system will use.
                </p>
              </div>

              <div className="mt-7 border-t border-white/15 pt-6">
                <p className="text-xs font-semibold uppercase text-white/70">Setup Progress</p>
                <div className="mt-4 flex items-center gap-5">
                  <div
                    className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
                    style={{
                      background: `conic-gradient(#7c3aed ${(institutionSetupProgress?.summary?.percent || 0) * 3.6}deg, rgba(255,255,255,0.14) 0deg)`,
                    }}
                  >
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-[var(--brand-primary)]">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{institutionSetupProgress?.summary?.percent || 0}%</p>
                        <p className="text-xs text-white/75">Complete</p>
                      </div>
                    </div>
                  </div>
                  {institutionSetupProgress?.summary && (
                    <p className="text-sm font-semibold text-emerald-200">
                      {institutionSetupProgress.summary.completed} of {institutionSetupProgress.summary.total} steps completed
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-8 hidden border-t border-white/15 pt-7 lg:block">
                <p className="text-xs font-semibold uppercase text-white/70">Setup Checklist</p>
                <div className="mt-4 space-y-2.5">
                  {[
                    ['Institution Type', false],
                    ['School Profile', true],
                    ['Academic Structure', true],
                    ['Streams & Classes', true],
                    ['Subjects', true],
                    ['Grading System', true],
                    ['Fee Structure', true],
                    ['Users & Permissions', true],
                  ].map(([label, done]) => (
                    <div key={label} className="flex items-center gap-3 text-sm">
                      <span className={cn(
                        "grid h-5 w-5 place-items-center rounded-full border",
                        done ? "border-emerald-300 bg-emerald-300 text-[var(--brand-primary)]" : "border-violet-300 text-violet-200"
                      )}>
                        {done ? <Check size={12} /> : <span className="h-2 w-2 rounded-full bg-current" />}
                      </span>
                      <span className={done ? 'text-white' : 'text-violet-200'}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-7 hidden rounded-lg border border-white/15 bg-white/10 p-4 lg:block">
                <div className="flex items-start gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-400 text-white">
                    <HelpCircle size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Need help?</p>
                    <p className="mt-1 text-xs leading-5 text-white/75">Check the setup guide or contact support.</p>
                  </div>
                  <ExternalLink size={15} className="ml-auto shrink-0 text-white/75" />
                </div>
              </div>
            </aside>

            <main className="flex min-h-screen flex-col bg-white px-5 py-6 sm:px-8 lg:h-screen lg:overflow-y-auto lg:px-12 lg:py-6 xl:px-16">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm font-semibold text-[var(--brand-primary)]">Step 1 of 3</p>
                  <h2 className="mt-2 text-3xl font-bold leading-tight text-slate-950">Select Institution Type</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                    Choose the active institution for this system. After saving, this will be locked for data safety.
                  </p>
                </div>
                <div className="hidden items-center gap-3 text-right lg:flex">
                  <ShieldCheck className="h-9 w-9 text-[var(--brand-primary)]" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Your data is safe with us</p>
                    <p className="mt-1 text-xs text-slate-500">We follow strict security standards</p>
                  </div>
                </div>
              </div>

              {institutionSetupSuccess && (
                <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  {institutionSetupSuccess}
                </div>
              )}

              <div className="mt-6 grid gap-5 lg:grid-cols-3">
                {INSTITUTION_OPTIONS.map((option) => {
                  const selected = institutionChoice === option.value;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setInstitutionChoice(option.value)}
                      className={cn(
                        "relative min-h-[185px] rounded-lg border bg-white p-5 text-center shadow-sm transition-all duration-150",
                        selected
                          ? "border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]/30"
                          : "border-slate-200 hover:border-[var(--brand-primary)]/50 hover:shadow-md"
                      )}
                    >
                      {selected && (
                        <span className="absolute right-5 top-5 grid h-7 w-7 place-items-center rounded-full bg-[var(--brand-primary)] text-white">
                          <Check size={16} />
                        </span>
                      )}
                      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-violet-100 bg-violet-50 text-[var(--brand-primary)]">
                        <Icon size={27} />
                      </span>
                      <p className="mt-4 text-lg font-bold text-slate-950">{option.label}</p>
                      <p className="mt-2 text-xs font-bold uppercase text-[var(--brand-primary)]">{option.subtitle}</p>
                      <p className="mx-auto mt-3 max-w-[240px] text-sm leading-5 text-slate-600">{option.description}</p>
                      <span className="mt-4 inline-flex min-h-[32px] items-center rounded-md bg-violet-50 px-4 text-sm font-medium text-[var(--brand-primary)]">
                        {option.range}
                      </span>
                    </button>
                  );
                })}
              </div>

              <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-slate-950">Institution Setup Readiness</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {isLoadingInstitutionSetupProgress
                        ? 'Checking current setup...'
                        : "You're almost there. Complete the remaining items to finish setup."}
                    </p>
                  </div>
                  {institutionSetupProgress?.summary && (
                    <p className="text-lg font-bold text-[var(--brand-primary)]">
                      {institutionSetupProgress.summary.completed}/{institutionSetupProgress.summary.total}
                    </p>
                  )}
                </div>
                <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[var(--brand-primary)] transition-all duration-300"
                    style={{ width: `${institutionSetupProgress?.summary?.percent || 0}%` }}
                  />
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--brand-primary)]">
                  {institutionSetupProgress?.summary?.percent || 0}% complete
                </p>
                {!isLoadingInstitutionSetupProgress && Array.isArray(institutionSetupProgress?.items) && (
                  <div className="mt-4 grid gap-2.5 lg:grid-cols-2">
                    {institutionSetupProgress.items.map((item) => (
                      <div key={item.key} className="flex min-h-[38px] items-center justify-between gap-4 rounded-md border border-slate-200 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={cn(
                            "grid h-5 w-5 shrink-0 place-items-center rounded-full",
                            item.completed ? 'bg-emerald-600 text-white' : 'bg-amber-50 text-amber-600'
                          )}>
                            {item.completed ? <CheckCircle size={14} /> : <Clock3 size={13} />}
                          </span>
                          <p className="truncate text-sm font-medium text-slate-800">{item.label}</p>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-slate-900">{item.current}/{item.target}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {institutionSetupError && (
                <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {institutionSetupError}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-gray-300 px-6 text-black"
                  onClick={() => {
                    setShowInstitutionSetupModal(false);
                    setPendingCredentialsData(null);
                    setInstitutionSetupError('');
                    setInstitutionSetupSuccess('');
                  }}
                  disabled={isLockingInstitution}
                >
                  Cancel Setup
                </Button>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 border-gray-300 px-8 text-black"
                    disabled
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    className="h-11 min-w-[160px] bg-[var(--brand-primary)] px-8 text-white hover:brightness-90"
                    onClick={institutionSetupSuccess ? handleContinueAfterInstitutionSetup : handleConfirmInstitutionSetup}
                    disabled={isLockingInstitution}
                  >
                    <span>{isLockingInstitution ? 'Saving...' : institutionSetupSuccess ? 'Continue' : 'Continue'}</span>
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
