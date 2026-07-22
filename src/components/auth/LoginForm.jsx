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
  RotateCw,
  Lock,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { authAPI, schoolAPI } from '../../services/api';
import { setBranchId, setSelectedInstitutionType } from '../../services/schoolContext';
import { useMobile } from '../../hooks/useMobileDetection';
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
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

const MOBILE_SPLASH_ASSETS = {
  login: '/splash/african-student-compass-bg.png',
  logo: '/splash/new/TrendsCORE-Logo.png',
  admin: '/splash/new/admin.png',
  teacher: '/splash/new/teacher.png',
  parent: '/splash/new/parent.png',
  student: '/splash/new/student.png',
  compass: '/splash/trendscore-compass.png',
};

const normalizeMobileRole = (userData) => {
  const roles = Array.isArray(userData?.roles) && userData.roles.length > 0 ? userData.roles : [userData?.role];
  const normalized = roles.map((role) => String(role || '').toUpperCase());

  if (normalized.some((role) => role.includes('ADMIN') || role.includes('OWNER'))) return 'admin';
  if (normalized.some((role) => role.includes('TEACHER') || role.includes('STAFF'))) return 'teacher';
  if (normalized.some((role) => role.includes('PARENT') || role.includes('GUARDIAN'))) return 'parent';
  if (normalized.some((role) => role.includes('STUDENT') || role.includes('LEARNER'))) return 'student';
  if (normalized.some((role) => role.includes('ACCOUNT'))) return 'admin';
  return 'admin';
};

export default function LoginForm({ onSwitchToForgotPassword, onLoginSuccess, brandingSettings }) {
  const isMobile = useMobile();
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
  const [formData, setFormData] = useState({ password: '', rememberMe: false });
  const [phoneOtp, setPhoneOtp] = useState({
    phone: '',
    challengeId: '',
    code: '',
    expiresAt: null,
    resendAfterSeconds: 0,
    smsConfigured: null,
    autofillAllowed: false,
    requiresOtp: true,
  });
  const [loginMode, setLoginMode] = useState('standard'); // 'standard' | 'phoneOtp' | 'student'

  const [studentLogin, setStudentLogin] = useState({
    phone: '',
    sessionToken: '',
    candidates: [],          // [{ studentUserId, admissionNumber, firstName, lastName, grade }]
    selectedStudentUserId: '',
    step: 'phone',           // 'phone' | 'pick' | 'password'
    password: '',
    isLoading: false,
    error: '',
    cooldown: 0,             // seconds countdown for 429 rate limit
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isPhoneOtpLoading, setIsPhoneOtpLoading] = useState(false);
  const [phoneOtpStep, setPhoneOtpStep] = useState('request');
  const [phoneOtpCooldown, setPhoneOtpCooldown] = useState(0);
  const [phonePasswordFallback, setPhonePasswordFallback] = useState(false);
  const [mobileRoleIntro, setMobileRoleIntro] = useState(null);
  const [loginBgRole, setLoginBgRole] = useState(null); // null | 'admin' | 'teacher' | 'parent' | 'student'
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
  const [sessionExpiredReason, setSessionExpiredReason] = useState(() => {
    const flag = sessionStorage.getItem('session_expired');
    if (flag) sessionStorage.removeItem('session_expired');
    return ['expired', 'forced_logout', 'inactivity'].includes(flag) ? flag : '';
  });

  const clearSessionNotice = () => {
    sessionStorage.removeItem('session_expired');
    setSessionExpiredReason('');
  };

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

  const validatePhoneOtpRequest = () => {
    const newErrors = {};
    const digits = phoneOtp.phone.replace(/\D/g, '');
    if (!digits) newErrors.phone = 'Phone number is required';
    else if (digits.length < 9) newErrors.phone = 'Enter a valid phone number';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePhoneOtpVerify = () => {
    const newErrors = {};
    const code = phoneOtp.code.replace(/\D/g, '');
    if (!phoneOtp.challengeId) newErrors.phone = 'Request a code first';
    if (!/^\d{6}$/.test(code)) newErrors.code = 'Enter the 6 digit code';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handlePhoneOtpChange = (e) => {
    const { name, value } = e.target;
    let formatted = value;
    if (name === 'phone') {
      formatted = value.replace(/\D/g, '').slice(0, 12);
    } else if (name === 'code') {
      formatted = value.replace(/\D/g, '').slice(0, 6);
    }
    setPhoneOtp(prev => ({
      ...prev,
      [name]: formatted,
    }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // Normalise any Kenyan number variant to +254XXXXXXXXX
  const normalizeKenyanPhone = (raw) => {
    const digits = String(raw).replace(/\D/g, '');
    if (digits.startsWith('254') && digits.length === 12) return `+${digits}`;
    if (digits.startsWith('0') && digits.length === 10) return `+254${digits.slice(1)}`;
    if (digits.length === 9) return `+254${digits}`;
    return raw.trim(); // pass through and let server validate
  };


  const buildLoginUserData = (credentialsData, identifier) => {
    const { user, mustChangePassword } = credentialsData;
    const resolvedInstitutionType = resolveInstitutionType(identifier, user);
    return {
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      roles: Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [user.role],
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      institutionType: resolvedInstitutionType,
      schoolId: user.schoolId || null,
      branchId: user.branchId || user.branch?.id || null,
      school: user.school || null,
      branch: user.branch || null,
      mustChangePassword,
      loginMethod: credentialsData.loginMethod || null,
    };
  };

  const finishLogin = (loginUserData, token, refreshToken) => {
    const options = { rememberMe: formData.rememberMe === true };
    if (isMobile) {
      setMobileRoleIntro({ user: loginUserData, token, refreshToken, options });
      return;
    }

    onLoginSuccess(loginUserData, token, refreshToken, options);
  };

  const completeBypassLogin = async (credentialsData, identifier = phoneOtp.phone) => {
    const { token, refreshToken, user } = credentialsData;
    const loginUserData = buildLoginUserData(credentialsData, identifier);

    const bid = user.branchId || user.branch?.id || '';
    if (bid) setBranchId(bid);
    setSelectedInstitutionType(loginUserData.institutionType);

    finishLogin(loginUserData, token, refreshToken);
  };

  useEffect(() => {
    if (!mobileRoleIntro) return undefined;

    const timer = window.setTimeout(() => {
      onLoginSuccess(
        mobileRoleIntro.user,
        mobileRoleIntro.token,
        mobileRoleIntro.refreshToken,
        mobileRoleIntro.options
      );
    }, 2300);

    return () => window.clearTimeout(timer);
  }, [mobileRoleIntro, onLoginSuccess]);

  useEffect(() => {
    if (phoneOtpCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setPhoneOtpCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [phoneOtpCooldown]);

  useEffect(() => {
    if (studentLogin.cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setStudentLogin(prev => ({ ...prev, cooldown: Math.max(0, prev.cooldown - 1) }));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [studentLogin.cooldown]);

  useEffect(() => {
    if (phoneOtpStep === 'verify' && phoneOtpCooldown === 0 && !phoneOtp.code) {
      setPhonePasswordFallback(true);
    }
  }, [phoneOtpStep, phoneOtpCooldown, phoneOtp.code]);

  useEffect(() => {
    if (phoneOtpStep !== 'verify' || phoneOtp.code || !('OTPCredential' in window) || !navigator.credentials) {
      return undefined;
    }

    // Only start Web OTP when server indicates autofill is allowed for this session
    if (!phoneOtp.autofillAllowed) return undefined;

    const controller = new AbortController();
    navigator.credentials.get({
      otp: { transport: ['sms'] },
      signal: controller.signal,
    }).then((credential) => {
      if (credential?.code) {
        setPhoneOtp(prev => ({ ...prev, code: String(credential.code).replace(/\D/g, '').slice(0, 6) }));
      }
    }).catch(() => {});

    return () => controller.abort();
  }, [phoneOtpStep, phoneOtp.code, phoneOtp.autofillAllowed]);

  // Auto-submit phone number when it reaches 9 digits on mobile
  useEffect(() => {
    if (isMobile && phoneOtpStep === 'request' && phoneOtp.phone.length === 9 && !isPhoneOtpLoading) {
      const timer = setTimeout(() => {
        handlePhoneOtpRequest();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [phoneOtp.phone, phoneOtpStep, isMobile, isPhoneOtpLoading]);

  // Auto-submit OTP code when it reaches 6 digits on mobile
  useEffect(() => {
    if (isMobile && phoneOtpStep === 'verify' && !phonePasswordFallback && phoneOtp.code.length === 6 && !isPhoneOtpLoading) {
      const timer = setTimeout(() => {
        handlePhoneOtpVerify();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [phoneOtp.code, phoneOtpStep, phonePasswordFallback, isMobile, isPhoneOtpLoading]);

  const handlePhoneOtpRequest = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!validatePhoneOtpRequest()) return;

    clearSessionNotice();
    setIsPhoneOtpLoading(true);
    setErrors({});
    try {
      const result = await authAPI.requestPhoneOtp({ phone: normalizeKenyanPhone(phoneOtp.phone) });

      setPhoneOtp(prev => ({
        ...prev,
        challengeId: result.challengeId || '',
        expiresAt: result.expiresAt || null,
        resendAfterSeconds: result.resendAfterSeconds || 60,
        code: result.devOtp || '',
        smsConfigured: result.smsConfigured ?? null,
        autofillAllowed: result.autofillAllowed || false,
        requiresOtp: result.requiresOtp !== false,
      }));

      if (result.requiresOtp === false) {
        setPhoneOtpCooldown(0);
        setPhoneOtpStep('verify');
        setPhonePasswordFallback(true);
        toast.success(result.message || 'Enter your password to sign in.');
        return;
      }

      // If SMS is not configured and autofill isn't allowed (i.e., not super-admin), show clear message and stop
      if (result.smsConfigured === false && !result.autofillAllowed) {
        setPhoneOtpCooldown(result.resendAfterSeconds || 60);
        setPhonePasswordFallback(true);
        setErrors({ form: result.message || 'SMS Not Configured. Contact Admin.' });
        toast.error(result.message || 'SMS Not Configured. Contact Admin.');
        return;
      }

      setPhoneOtpCooldown(result.resendAfterSeconds || 60);
      setPhoneOtpStep('verify');
      setPhonePasswordFallback(false);
      // Detect role from API response and switch background
      if (result.role || result.userRole) {
        const raw = String(result.role || result.userRole || '').toUpperCase();
        if (raw.includes('ADMIN') || raw.includes('OWNER') || raw.includes('ACCOUNT')) setLoginBgRole('admin');
        else if (raw.includes('TEACHER') || raw.includes('STAFF')) setLoginBgRole('teacher');
        else if (raw.includes('PARENT') || raw.includes('GUARDIAN')) setLoginBgRole('parent');
        else if (raw.includes('STUDENT') || raw.includes('LEARNER')) setLoginBgRole('student');
      }
      toast.success(result.message || 'Code sent if the parent account exists.');
    } catch (error) {
      setErrors({ form: error.message || 'Unable to request code' });
    } finally {
      setIsPhoneOtpLoading(false);
    }
  };

  const handleUsePhonePassword = () => {
    if (!validatePhoneOtpRequest()) return;

    setPhoneOtpStep('verify');
    setPhonePasswordFallback(true);
    setPhoneOtpCooldown(0);
    setErrors({});
  };

  const handlePhoneOtpVerify = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!validatePhoneOtpVerify()) return;

    setIsPhoneOtpLoading(true);
    setErrors({});
    try {
      const credentialsData = await authAPI.verifyPhoneOtp({
        challengeId: phoneOtp.challengeId,
        phone: normalizeKenyanPhone(phoneOtp.phone),
        code: phoneOtp.code,
        rememberMe: formData.rememberMe === true,
      });
      await completeBypassLogin(credentialsData, phoneOtp.phone);
    } catch (error) {
      setErrors({ form: error.message || 'Unable to verify code' });
    } finally {
      setIsPhoneOtpLoading(false);
    }
  };

  const handlePhonePasswordLogin = async (e) => {
    e.preventDefault();
    const newErrors = {};
    const digits = phoneOtp.phone.replace(/\D/g, '');
    if (!digits) newErrors.phone = 'Phone number is required';
    else if (digits.length < 9) newErrors.phone = 'Enter a valid phone number';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Min 6 characters';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsPhoneOtpLoading(true);
    setErrors({});
    try {
      const credentialsData = await authAPI.login({
        phone: normalizeKenyanPhone(phoneOtp.phone),
        password: formData.password,
        rememberMe: formData.rememberMe === true,
      });

      if (credentialsData?.user?.role === 'SUPER_ADMIN' && credentialsData?.user?.requiresInstitutionSetup) {
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

      await completeBypassLogin(credentialsData, phoneOtp.phone);
    } catch (error) {
      setErrors({ form: error.message || 'Authentication failed' });
    } finally {
      setIsPhoneOtpLoading(false);
    }
  };

  const handleStudentPhoneLookup = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const digits = studentLogin.phone.replace(/\D/g, '');
    if (digits.length < 9) {
      setStudentLogin(prev => ({ ...prev, error: 'Enter a valid phone number (min 9 digits)' }));
      return;
    }
    setStudentLogin(prev => ({ ...prev, isLoading: true, error: '' }));
    try {
      const result = await authAPI.studentPhoneLookup({ phone: normalizeKenyanPhone(studentLogin.phone) });
      const candidates = result.candidates || [];
      const sessionToken = result.sessionToken || '';
      if (candidates.length === 0) {
        setStudentLogin(prev => ({
          ...prev,
          isLoading: false,
          error: 'No student account found for this phone number',
          sessionToken,
          candidates: [],
        }));
      } else if (candidates.length === 1) {
        setStudentLogin(prev => ({
          ...prev,
          isLoading: false,
          sessionToken,
          candidates,
          selectedStudentUserId: candidates[0].studentUserId,
          step: 'password',
          error: '',
        }));
      } else {
        setStudentLogin(prev => ({
          ...prev,
          isLoading: false,
          sessionToken,
          candidates,
          step: 'pick',
          error: '',
        }));
      }
    } catch (error) {
      const msg = error.message || 'Unable to look up phone number';
      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes('too many') || lowerMsg.includes('wait')) {
        const seconds = parseInt((msg.match(/(\d+)\s*second/) || [])[1] || '60', 10);
        setStudentLogin(prev => ({ ...prev, isLoading: false, cooldown: seconds, error: '' }));
      } else {
        setStudentLogin(prev => ({ ...prev, isLoading: false, error: msg }));
      }
    }
  };

  const handleStudentCandidateSelect = (studentUserId) => {
    setStudentLogin(prev => ({ ...prev, selectedStudentUserId: studentUserId, error: '' }));
  };

  const handleStudentCandidateContinue = () => {
    if (!studentLogin.selectedStudentUserId) return;
    setStudentLogin(prev => ({ ...prev, step: 'password', error: '' }));
  };

  const handleStudentPhoneLogin = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (studentLogin.password.length < 6) {
      setStudentLogin(prev => ({ ...prev, error: 'Password must be at least 6 characters' }));
      return;
    }
    setStudentLogin(prev => ({ ...prev, isLoading: true, error: '' }));
    try {
      const credentialsData = await authAPI.studentPhoneLogin({
        sessionToken: studentLogin.sessionToken,
        studentUserId: studentLogin.selectedStudentUserId,
        password: studentLogin.password,
        rememberMe: formData.rememberMe === true,
      });
      setStudentLogin(prev => ({ ...prev, isLoading: false }));
      await completeBypassLogin(credentialsData, studentLogin.phone);
    } catch (error) {
      const msg = error.message || 'Authentication failed';
      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes('too many') || lowerMsg.includes('wait')) {
        const seconds = parseInt((msg.match(/(\d+)\s*second/) || [])[1] || '60', 10);
        setStudentLogin(prev => ({ ...prev, isLoading: false, cooldown: seconds, error: '' }));
      } else {
        setStudentLogin(prev => ({ ...prev, isLoading: false, error: msg }));
      }
    }
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

  const loginBackgroundColor = brandingSettings?.primaryColor || 'var(--brand-primary)';
  const mobileRole = normalizeMobileRole(mobileRoleIntro?.user);
  const mobileFirstName =
    mobileRoleIntro?.user?.firstName ||
    String(mobileRoleIntro?.user?.name || 'there').split(' ')[0] ||
    'there';
  const mobilePhoneDisplay = phoneOtp.phone.trim() || '—';
  const formattedCooldown = `00:${String(phoneOtpCooldown).padStart(2, '0')}`;
  const formattedStudentCooldown = `00:${String(studentLogin.cooldown).padStart(2, '0')}`;

  const handleMobileCodeChange = (index, value) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      setPhoneOtp(prev => ({
        ...prev,
        code: `${prev.code.slice(0, index)}${prev.code.slice(index + 1)}`.slice(0, 6),
      }));
      return;
    }

    const nextDigits = `${phoneOtp.code.slice(0, index)}${digits}${phoneOtp.code.slice(index + digits.length)}`.slice(0, 6);
    setPhoneOtp(prev => ({ ...prev, code: nextDigits }));
  };

  const handleMobileCodeKeyDown = (index, event) => {
    if (event.key !== 'Backspace' || phoneOtp.code[index] || index <= 0) return;
    const previous = document.getElementById(`mobile-otp-${index - 1}`);
    previous?.focus();
  };

  if (mobileRoleIntro) {
    return (
      <div className="relative min-h-[100dvh] w-full overflow-hidden bg-slate-950 text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${MOBILE_SPLASH_ASSETS[mobileRole]})` }}
        />

        <div
          className="relative z-10 flex min-h-[100dvh] flex-col justify-end px-6"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
        >
          <div className="mx-auto w-full max-w-[19rem] rounded-xl border border-white/35 bg-white/28 px-5 py-5 text-center shadow-2xl backdrop-blur-xl">
            <img
              src={MOBILE_SPLASH_ASSETS.logo}
              alt="TrendSCORE"
              className="mx-auto mb-4 w-40 object-contain"
            />
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/85">
              {mobileRole} portal
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight text-white">
              Welcome back, {mobileFirstName}
            </h1>
            <p className="mt-2 text-xs font-medium leading-5 text-white/85">
              Loading your {mobileRole} workspace.
            </p>
            <div className="mx-auto mt-5 h-8 w-8 rounded-full border-4 border-white/35 border-t-orange-500 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (isMobile && !showInstitutionSetupModal) {
    // Resolve which background image to use
    const bgImage = loginBgRole
      ? MOBILE_SPLASH_ASSETS[loginBgRole] || MOBILE_SPLASH_ASSETS.login
      : MOBILE_SPLASH_ASSETS.login;

    // Format the phone number for the KE field display
    const rawDigits = phoneOtp.phone.replace(/\D/g, '');
    // Strip leading 0 or 254 for display after the +254 prefix
    let displayDigits = rawDigits;
    if (displayDigits.startsWith('254')) displayDigits = displayDigits.slice(3);
    else if (displayDigits.startsWith('0')) displayDigits = displayDigits.slice(1);
    // Format as: 712 345 678
    const formatDisplay = (d) => {
      if (!d) return '';
      return d.replace(/(\d{3})(\d{3})(\d{0,3})/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' '));
    };

    return (
      <div
        className="relative min-h-[100dvh] w-full overflow-hidden text-slate-950"
        style={{ backgroundColor: '#FAF9F6' }}
      >
        {/* Background image removed */}

        {/* Custom compass dial SVG — bottom-right, clipped, slowly spinning */}
        <style>{`
          @keyframes compassSpin {
            0%   { transform: rotate(0deg)   skewX(0deg)   skewY(0deg); }
            25%  { transform: rotate(90deg)  skewX(1.5deg) skewY(0.8deg); }
            50%  { transform: rotate(180deg) skewX(0deg)   skewY(0deg); }
            75%  { transform: rotate(270deg) skewX(-1.5deg) skewY(-0.8deg); }
            100% { transform: rotate(360deg) skewX(0deg)   skewY(0deg); }
          }
          @keyframes mobileLogoFadeIn {
            0% {
              opacity: 0;
              transform: translateY(8px) scale(0.98);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}</style>
        <svg
          aria-hidden="true"
          viewBox="0 0 300 300"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'absolute',
            bottom: '-190px',
            right: '-190px',
            width: '500px',
            height: '500px',
            opacity: 0.1,
            animation: 'compassSpin 28s linear infinite',
            transformOrigin: 'center center',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <circle cx="150" cy="150" r="145" fill="none" stroke="#041635" strokeWidth="0.6" />
          <circle cx="150" cy="150" r="138" fill="none" stroke="#041635" strokeWidth="0.3" />
          <circle cx="150" cy="150" r="118" fill="none" stroke="#041635" strokeWidth="0.5" />
          <circle cx="150" cy="150" r="112" fill="none" stroke="#041635" strokeWidth="0.25" />
          {Array.from({ length: 72 }).map((_, i) => {
            const angle = (i * 5 * Math.PI) / 180;
            const isMajor = i % 9 === 0;
            const isMid   = i % 3 === 0;
            const outer = 145;
            const inner = isMajor ? 128 : isMid ? 132 : 136;
            const x1 = 150 + outer * Math.sin(angle);
            const y1 = 150 - outer * Math.cos(angle);
            const x2 = 150 + inner * Math.sin(angle);
            const y2 = 150 - inner * Math.cos(angle);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#041635" strokeWidth={isMajor ? 0.9 : isMid ? 0.55 : 0.35} />;
          })}
          <text x="150" y="106" textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="600" fill="#041635" fontFamily="system-ui, sans-serif" letterSpacing="2">N</text>
          <text x="150" y="198" textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="400" fill="#041635" fontFamily="system-ui, sans-serif">S</text>
          <text x="196" y="150" textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="400" fill="#041635" fontFamily="system-ui, sans-serif">E</text>
          <text x="104" y="150" textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="400" fill="#041635" fontFamily="system-ui, sans-serif">W</text>
          <circle cx="150" cy="150" r="28" fill="none" stroke="#041635" strokeWidth="0.5" />
          <circle cx="150" cy="150" r="4"  fill="none" stroke="#041635" strokeWidth="0.8" />
          <polygon points="150,118 153,150 150,160 147,150" fill="none" stroke="#041635" strokeWidth="0.7" strokeLinejoin="round" />
          <polygon points="150,182 153,150 150,140 147,150" fill="none" stroke="#041635" strokeWidth="0.5" strokeLinejoin="round" opacity="0.5" />
          <line x1="150" y1="122" x2="150" y2="135" stroke="#041635" strokeWidth="0.35" />
          <line x1="150" y1="165" x2="150" y2="178" stroke="#041635" strokeWidth="0.35" />
          <line x1="122" y1="150" x2="135" y2="150" stroke="#041635" strokeWidth="0.35" />
          <line x1="165" y1="150" x2="178" y2="150" stroke="#041635" strokeWidth="0.35" />
        </svg>

        <div
          className="relative z-10 flex min-h-[100dvh] flex-col px-6"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
          }}
        >
          <div className="flex flex-1 flex-col items-center justify-start pt-16 w-full max-w-[18.5rem] mx-auto">
            {/* Logo — 15% larger than before (11rem * 1.15 = 12.65rem) */}
            <img
              src={MOBILE_SPLASH_ASSETS.logo}
              alt="TrendSCORE"
              className="mx-auto w-full max-w-[12.65rem] object-contain"
              style={{ animation: 'mobileLogoFadeIn 750ms ease-out 120ms both' }}
            />

            {/* Timeless welcome text */}
            <div className="mt-8 mb-2 text-center w-full">
              <h1 className="text-2xl font-bold text-[#0E2A5A] tracking-tight">Welcome back</h1>
              <p className="mt-1.5 text-xs font-medium text-slate-500">
                {loginMode === 'student' ? 'Sign in with your parent\'s phone number.' : 'Continue with your registered phone number.'}
              </p>
            </div>

            {/* Card — Solid white card, 24px radius, orange border */}
            {loginMode === 'student' ? (
              /* ── Mobile Student Login Flow ── */
              <div className="mt-6 w-full max-w-[18.5rem] px-1 py-4 transition-all">
                {studentLogin.error && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/95 px-3 py-2 text-xs font-medium text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{studentLogin.error}</span>
                  </div>
                )}

                {studentLogin.isLoading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="relative h-10 w-10">
                      <div className="absolute inset-0 rounded-full border-4 border-[#F47C20]/15" />
                      <div className="absolute inset-0 rounded-full border-4 border-t-[#F47C20] animate-spin" />
                    </div>
                    <p className="mt-4 text-xs font-semibold text-[#0E2A5A] animate-pulse">
                      {studentLogin.step === 'phone' ? 'Looking up account...' : 'Signing in...'}
                    </p>
                  </div>
                ) : studentLogin.step === 'phone' ? (
                  <form onSubmit={handleStudentPhoneLookup}>
                    <label htmlFor="student-mobile-phone" className="text-[10px] font-bold tracking-wider text-slate-400 block mb-2 uppercase">Parent&apos;s Phone Number</label>
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-3 focus-within:border-[#F47C20] focus-within:ring-4 focus-within:ring-[#F47C20]/15 transition-all shadow-sm">
                      <span className="text-base leading-none" aria-label="Kenya">🇰🇪</span>
                      <span className="text-sm font-semibold text-slate-500 select-none">+254</span>
                      <span className="h-4 w-px bg-slate-300 shrink-0" />
                      <input
                        id="student-mobile-phone"
                        type="tel"
                        inputMode="numeric"
                        value={studentLogin.phone}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/\D/g, '').slice(0, 12);
                          setStudentLogin(prev => ({ ...prev, phone: clean, error: '' }));
                        }}
                        placeholder="712 345 678"
                        autoComplete="tel"
                        className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-300"
                      />
                    </div>
                    {studentLogin.cooldown > 0 && (
                      <p className="mt-2 text-xs font-medium text-amber-700">
                        Please wait {formattedStudentCooldown} before trying again
                      </p>
                    )}
                    <Button
                      type="submit"
                      disabled={studentLogin.isLoading || studentLogin.cooldown > 0}
                      className="mt-5 h-12 w-full rounded-xl bg-[#F47C20] text-sm font-semibold text-white shadow-md shadow-[#F47C20]/25 hover:bg-[#e06b12] active:scale-[0.98] transition-all disabled:opacity-60"
                    >
                      Find my account
                    </Button>
                    <button
                      type="button"
                      onClick={() => setLoginMode('standard')}
                      className="mt-4 w-full text-center text-xs font-semibold text-slate-500 hover:text-[#F47C20]"
                    >
                      ← Back to login
                    </button>
                  </form>
                ) : studentLogin.step === 'pick' ? (
                  <div>
                    <p className="text-sm font-bold text-[#0E2A5A] mb-3">Who are you?</p>
                    <div className="space-y-2">
                      {studentLogin.candidates.map((c) => (
                        <button
                          key={c.studentUserId}
                          type="button"
                          onClick={() => handleStudentCandidateSelect(c.studentUserId)}
                          className={cn(
                            'w-full rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-all',
                            studentLogin.selectedStudentUserId === c.studentUserId
                              ? 'border-[#F47C20] bg-orange-50 text-[#0E2A5A]'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-[#F47C20]/50'
                          )}
                        >
                          {c.firstName} {c.lastName} — {c.admissionNumber} ({c.grade})
                        </button>
                      ))}
                    </div>
                    <Button
                      type="button"
                      onClick={handleStudentCandidateContinue}
                      disabled={!studentLogin.selectedStudentUserId}
                      className="mt-5 h-12 w-full rounded-xl bg-[#F47C20] text-sm font-semibold text-white shadow-md shadow-[#F47C20]/25 hover:bg-[#e06b12] active:scale-[0.98] transition-all disabled:opacity-40"
                    >
                      Continue
                    </Button>
                  </div>
                ) : (
                  /* step === 'password' */
                  <form onSubmit={handleStudentPhoneLogin}>
                    {(() => {
                      const selected = studentLogin.candidates.find(c => c.studentUserId === studentLogin.selectedStudentUserId);
                      return selected ? (
                        <p className="mb-3 text-sm font-semibold text-[#0E2A5A]">
                          {selected.firstName} {selected.lastName}
                        </p>
                      ) : null;
                    })()}
                    <Label htmlFor="student-mobile-password" className="text-[10px] font-bold tracking-wider text-slate-400 block mb-2 uppercase">Password</Label>
                    <div className="relative mt-2">
                      <Input
                        id="student-mobile-password"
                        type={showPassword ? 'text' : 'password'}
                        value={studentLogin.password}
                        onChange={(e) => setStudentLogin(prev => ({ ...prev, password: e.target.value, error: '' }))}
                        className="h-11 rounded-xl border-slate-300 bg-white pr-11 text-sm font-medium text-slate-900"
                        placeholder="Enter password"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    {studentLogin.cooldown > 0 && (
                      <p className="mt-2 text-xs font-medium text-amber-700">
                        Please wait {formattedStudentCooldown} before trying again
                      </p>
                    )}
                    <Button
                      type="submit"
                      disabled={studentLogin.isLoading || studentLogin.cooldown > 0}
                      className="mt-5 h-12 w-full rounded-xl bg-[#F47C20] text-sm font-semibold text-white shadow-md shadow-[#F47C20]/25 hover:bg-[#e06b12] active:scale-[0.98] transition-all disabled:opacity-60"
                    >
                      Sign in
                    </Button>
                    <button
                      type="button"
                      onClick={() => setStudentLogin(prev => ({
                        ...prev,
                        step: prev.candidates.length > 1 ? 'pick' : 'phone',
                        password: '',
                        error: '',
                      }))}
                      className="mt-4 w-full text-center text-xs font-semibold text-slate-500 hover:text-[#F47C20]"
                    >
                      ← Back
                    </button>
                  </form>
                )}
              </div>
            ) : (
            /* ── Existing Mobile OTP / Password Flow ── */
            <form
              onSubmit={phoneOtpStep === 'request'
                ? handlePhoneOtpRequest
                : phonePasswordFallback
                  ? handlePhonePasswordLogin
                  : handlePhoneOtpVerify}
              className="mt-6 w-full max-w-[18.5rem] px-1 py-4 transition-all"
            >
              {errors.form && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/95 px-3 py-2 text-xs font-medium text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errors.form}</span>
                </div>
              )}

              {isPhoneOtpLoading ? (
                /* Premium preloader animation */
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="relative h-10 w-10">
                    <div className="absolute inset-0 rounded-full border-4 border-[#F47C20]/15" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-[#F47C20] animate-spin" />
                  </div>
                  <p className="mt-4 text-xs font-semibold text-[#0E2A5A] animate-pulse">
                    {phoneOtpStep === 'request' ? 'Verifying phone number...' : 'Authenticating...'}
                  </p>
                </div>
              ) : (
                <>
                  {phoneOtpStep === 'request' ? (
                    <>
                      <label htmlFor="login-phone" className="text-[10px] font-bold tracking-wider text-slate-400 block mb-2 uppercase">PHONE NUMBER</label>

                      {/* KE flag + +254 prefix + formatted input */}
                      <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-3 focus-within:border-[#F47C20] focus-within:ring-4 focus-within:ring-[#F47C20]/15 transition-all shadow-sm">
                        <span className="text-base leading-none" aria-label="Kenya">🇰🇪</span>
                        <span className="text-sm font-semibold text-slate-500 select-none">+254</span>
                        <span className="h-4 w-px bg-slate-300 shrink-0" />
                        <input
                          id="login-phone"
                          type="tel"
                          name="phone"
                          value={formatDisplay(displayDigits)}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/\D/g, '').replace(/^(254|0)/, '').slice(0, 9);
                            setPhoneOtp(prev => ({ ...prev, phone: clean }));
                            if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                          }}
                          placeholder="712 345 678"
                          autoComplete="tel"
                          inputMode="numeric"
                          className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-300"
                        />
                      </div>
                      {errors.phone && <p className="mt-2 text-xs font-bold uppercase text-red-600">{errors.phone}</p>}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <span className="text-sm font-bold text-[#0E2A5A]">🇰🇪 +254 {formatDisplay(displayDigits)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setPhoneOtpStep('request');
                            setPhonePasswordFallback(false);
                            setLoginBgRole(null);
                            setPhoneOtp(prev => ({ ...prev, code: '', requiresOtp: true }));
                          }}
                          className="ml-1 text-sm font-semibold text-[#F47C20]"
                        >
                          Change
                        </button>
                      </div>

                      {phoneOtp.requiresOtp !== false && !phonePasswordFallback && (
                        <div className="mt-4">
                          <Label className="text-xs font-bold tracking-wider text-slate-400 block mb-2 uppercase">Enter OTP</Label>
                          <div className="mt-2 grid grid-cols-6 gap-1.5">
                            {Array.from({ length: 6 }).map((_, index) => (
                              <input
                                key={index}
                                id={`mobile-otp-${index}`}
                                type="text"
                                inputMode="numeric"
                                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                                value={phoneOtp.code[index] || ''}
                                onChange={(event) => handleMobileCodeChange(index, event.target.value)}
                                onKeyDown={(event) => handleMobileCodeKeyDown(index, event)}
                                className={cn(
                                  'aspect-square min-w-0 rounded-md border border-slate-300 bg-white text-center text-xl font-semibold text-[#0E2A5A] shadow-sm outline-none focus:border-[#F47C20] focus:ring-4 focus:ring-[#F47C20]/25',
                                  errors.code && 'border-red-400 bg-red-50'
                                )}
                              />
                            ))}
                          </div>
                          {errors.code && <p className="mt-2 text-xs font-bold uppercase text-red-600">{errors.code}</p>}
                        </div>
                      )}

                      {phonePasswordFallback && (
                        <div className="mt-4">
                          <Label htmlFor="phone-password" className="text-xs font-bold tracking-wider text-slate-400 block mb-2 uppercase">
                            Password
                          </Label>
                          <div className="relative mt-2">
                            <Input
                              id="phone-password"
                              type={showPassword ? 'text' : 'password'}
                              name="password"
                              value={formData.password}
                              onChange={handleChange}
                              className={cn(
                                'h-11 rounded-md border-slate-300 bg-white pr-11 text-sm font-medium text-slate-900',
                                errors.password && 'border-red-400 bg-red-50'
                              )}
                              placeholder="Enter password"
                              autoComplete="current-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                            >
                              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                            </button>
                          </div>
                          {errors.password && <p className="mt-2 text-xs font-bold uppercase text-red-600">{errors.password}</p>}
                        </div>
                      )}

                      {phoneOtp.requiresOtp !== false && (
                        <div className="mt-5 text-center text-sm font-medium text-slate-500">
                          Didn't receive OTP?{' '}
                          <button
                            type="button"
                            onClick={handlePhoneOtpRequest}
                            disabled={isPhoneOtpLoading || phoneOtpCooldown > 0}
                            className="font-bold text-[#F47C20] disabled:text-orange-300"
                          >
                            {phoneOtpCooldown > 0 ? `Resend in ${formattedCooldown}` : 'Resend'}
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {phonePasswordFallback && (
                    <Button
                      type="submit"
                      disabled={isPhoneOtpLoading}
                      className="mt-6 h-14 w-full rounded-xl bg-[#F47C20] text-base font-semibold text-white shadow-md shadow-[#F47C20]/25 hover:bg-[#e06b12] active:scale-[0.98] transition-all"
                    >
                      <span className="flex items-center gap-2 justify-center">
                        Sign In
                        <ArrowRight size={18} />
                      </span>
                    </Button>
                  )}

                  {phoneOtp.requiresOtp !== false && phoneOtpStep === 'verify' && (
                    <>
                      <div className="my-5 flex items-center gap-4 text-xs font-medium text-slate-400">
                        <span className="h-px flex-1 bg-slate-200" />
                        OR
                        <span className="h-px flex-1 bg-slate-200" />
                      </div>
                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => setPhonePasswordFallback(prev => !prev)}
                          className="inline-flex items-center gap-2 text-base font-semibold text-[#F47C20]"
                        >
                          <Lock size={17} />
                          {phonePasswordFallback ? 'Use OTP' : 'Use Password'}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Security trust badge */}
              <div className="mt-5 flex items-center justify-start gap-2 text-xs font-medium text-slate-400">
                <Lock size={12} className="text-slate-300" />
                <span>Trusted by schools across Kenya</span>
              </div>

              {/* Switch to student login */}
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('student');
                    setStudentLogin(prev => ({ ...prev, step: 'phone', phone: '', error: '', password: '', candidates: [], selectedStudentUserId: '', sessionToken: '' }));
                  }}
                  className="text-xs font-semibold text-[#F47C20] hover:underline"
                >
                  Switch to student login
                </button>
              </div>
            </form>
            )} {/* end loginMode !== 'student' ternary */}
          </div>

          {/* Page footer */}
          <div className="w-full max-w-[18.5rem] mx-auto pb-2 pt-6">
            <div className="h-px w-full bg-slate-200/60" />
            <p className="mt-3 text-left text-[10px] font-medium text-slate-400 tracking-wide">
              &copy; 2026 &bull; A product of Trends Core
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundColor: loginBackgroundColor
      }}
    >

      {sessionExpiredReason && (
        <div className="w-full max-w-[20.5rem] sm:max-w-sm mb-2 sm:mb-3 flex items-start gap-2 px-3 py-2.5 sm:px-4 sm:py-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-xs sm:text-sm font-medium relative z-10">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          {sessionExpiredReason === 'forced_logout'
            ? 'You were signed out by an administrator. Please complete the required onboarding and sign in again.'
            : sessionExpiredReason === 'inactivity'
              ? 'You were signed out after 30 minutes of inactivity. Please sign in again.'
              : 'Your session has expired. Please sign in again.'}
        </div>
      )}

      <Card className="w-full max-w-[20.5rem] sm:max-w-sm border-white/20 bg-white/95 backdrop-blur-xl shadow-2xl relative z-10 animate-fade-up">
        <CardHeader className="pt-4 pb-1 sm:pt-6 sm:pb-2">
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

          <>
              <div className="text-center mb-4">
                <h1 className="text-2xl font-semibold text-gray-900 leading-tight">
                  {brandingSettings?.welcomeTitle || 'Welcome Back!'}
                </h1>
                {brandingSettings?.welcomeMessage && (
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mt-2 px-4">
                    {brandingSettings.welcomeMessage}
                  </p>
                )}
              </div>

              {/* Login mode tabs */}
              <div className="flex gap-1 rounded-lg bg-gray-100 p-1 mb-5">
                <button
                  type="button"
                  onClick={() => setLoginMode('standard')}
                  className={cn(
                    'flex-1 rounded-md py-1.5 text-xs font-semibold transition-all',
                    loginMode === 'standard' || loginMode === 'phoneOtp'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  Parent / Staff
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('student');
                    setStudentLogin(prev => ({ ...prev, step: 'phone', phone: '', error: '', password: '', candidates: [], selectedStudentUserId: '', sessionToken: '' }));
                  }}
                  className={cn(
                    'flex-1 rounded-md py-1.5 text-xs font-semibold transition-all',
                    loginMode === 'student'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  Student
                </button>
              </div>

              {loginMode === 'student' ? (
                /* ── Desktop Student Login Flow ── */
                <div className="space-y-4">
                  {studentLogin.error && (
                    <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3 text-red-700">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span className="text-sm font-medium">{studentLogin.error}</span>
                    </div>
                  )}

                  {studentLogin.step === 'phone' && (
                    <form onSubmit={handleStudentPhoneLookup} className="space-y-3.5">
                      <div className="space-y-2">
                        <Label htmlFor="student-phone" className="text-gray-700 font-medium ml-1">Parent&apos;s phone number</Label>
                        <Input
                          id="student-phone"
                          type="tel"
                          inputMode="tel"
                          value={studentLogin.phone}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '').slice(0, 12);
                            setStudentLogin(prev => ({ ...prev, phone: v, error: '' }));
                          }}
                          className="h-12 border-gray-200 focus:border-brand-purple focus:ring-brand-purple/20"
                          placeholder="0712 345 678"
                          autoComplete="tel"
                        />
                      </div>
                      {studentLogin.cooldown > 0 && (
                        <p className="text-xs font-medium text-amber-700">
                          Please wait {formattedStudentCooldown} before trying again
                        </p>
                      )}
                      <Button
                        type="submit"
                        disabled={studentLogin.isLoading || studentLogin.cooldown > 0}
                        className="w-full h-10 sm:h-12 text-sm font-medium bg-brand-purple hover:bg-brand-purple/90 disabled:opacity-60"
                      >
                        {studentLogin.isLoading ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Looking up account...</span>
                          </div>
                        ) : 'Find my account'}
                      </Button>
                    </form>
                  )}

                  {studentLogin.step === 'pick' && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-gray-900">Who are you?</p>
                      <div className="space-y-2">
                        {studentLogin.candidates.map((c) => (
                          <button
                            key={c.studentUserId}
                            type="button"
                            onClick={() => handleStudentCandidateSelect(c.studentUserId)}
                            className={cn(
                              'w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-all',
                              studentLogin.selectedStudentUserId === c.studentUserId
                                ? 'border-brand-purple bg-violet-50 text-gray-900'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-brand-purple/50'
                            )}
                          >
                            {c.firstName} {c.lastName} — {c.admissionNumber} ({c.grade})
                          </button>
                        ))}
                      </div>
                      <Button
                        type="button"
                        onClick={handleStudentCandidateContinue}
                        disabled={!studentLogin.selectedStudentUserId}
                        className="w-full h-10 sm:h-12 text-sm font-medium bg-brand-purple hover:bg-brand-purple/90 disabled:opacity-40"
                      >
                        Continue
                      </Button>
                    </div>
                  )}

                  {studentLogin.step === 'password' && (
                    <form onSubmit={handleStudentPhoneLogin} className="space-y-3.5">
                      {(() => {
                        const selected = studentLogin.candidates.find(c => c.studentUserId === studentLogin.selectedStudentUserId);
                        return selected ? (
                          <p className="text-sm font-semibold text-gray-900">
                            {selected.firstName} {selected.lastName}
                          </p>
                        ) : null;
                      })()}
                      <div className="space-y-2">
                        <Label htmlFor="student-password" className="text-gray-700 font-medium">Password</Label>
                        <div className="relative">
                          <Input
                            id="student-password"
                            type={showPassword ? 'text' : 'password'}
                            value={studentLogin.password}
                            onChange={(e) => setStudentLogin(prev => ({ ...prev, password: e.target.value, error: '' }))}
                            className="h-12 pr-12 border-gray-200 focus:border-brand-purple focus:ring-brand-purple/20"
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
                      </div>
                      {studentLogin.cooldown > 0 && (
                        <p className="text-xs font-medium text-amber-700">
                          Please wait {formattedStudentCooldown} before trying again
                        </p>
                      )}
                      <Button
                        type="submit"
                        disabled={studentLogin.isLoading || studentLogin.cooldown > 0}
                        className="w-full h-10 sm:h-12 text-sm font-medium bg-brand-purple hover:bg-brand-purple/90 disabled:opacity-60"
                      >
                        {studentLogin.isLoading ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Signing in...</span>
                          </div>
                        ) : 'Sign in'}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setStudentLogin(prev => ({
                          ...prev,
                          step: prev.candidates.length > 1 ? 'pick' : 'phone',
                          password: '',
                          error: '',
                        }))}
                        className="w-full text-center text-xs font-medium text-gray-500 hover:text-brand-purple"
                      >
                        ← Back
                      </button>
                    </form>
                  )}
                </div>
              ) : (
              /* ── Existing Phone OTP / Password Flow ── */
              <form
                onSubmit={phoneOtpStep === 'request'
                  ? handlePhoneOtpRequest
                  : phonePasswordFallback
                    ? handlePhonePasswordLogin
                    : handlePhoneOtpVerify}
                className="space-y-3.5 sm:space-y-5"
              >
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
                    <Label htmlFor="login-phone" className="text-gray-700 font-medium ml-1">Phone number</Label>
                    <Input
                      id="login-phone"
                      type="tel"
                      name="phone"
                      value={phoneOtp.phone}
                      onChange={handlePhoneOtpChange}
                      className={cn(
                        "h-12 border-gray-200 focus:border-brand-purple focus:ring-brand-purple/20",
                        errors.phone && "border-red-500 bg-red-50"
                      )}
                      placeholder="0712 345 678"
                      autoComplete="tel"
                      inputMode="tel"
                      disabled={phoneOtpStep === 'verify' && isPhoneOtpLoading && !phonePasswordFallback}
                    />
                    {errors.phone && <p className="text-red-600 text-[10px] font-medium uppercase ml-1">{errors.phone}</p>}
                  </div>

                  {phoneOtp.requiresOtp !== false && phoneOtpStep === 'verify' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <Label htmlFor="parent-phone-code" className="text-gray-700 font-medium">Code</Label>
                        <button
                          type="button"
                          onClick={handlePhoneOtpRequest}
                          disabled={isPhoneOtpLoading || phoneOtpCooldown > 0}
                          className="inline-flex items-center gap-1 text-[10px] text-brand-purple hover:underline font-medium disabled:text-gray-400 disabled:no-underline"
                        >
                          <RotateCw size={11} />
                          {phoneOtpCooldown > 0 ? `${phoneOtpCooldown}s` : 'Resend'}
                        </button>
                      </div>
                      <Input
                        id="parent-phone-code"
                        type="text"
                        name="code"
                        value={phoneOtp.code}
                        onChange={handlePhoneOtpChange}
                        className={cn(
                          "h-12 border-gray-200 text-center text-lg font-semibold tracking-[0.35em] focus:border-brand-purple focus:ring-brand-purple/20",
                          errors.code && "border-red-500 bg-red-50"
                        )}
                        placeholder="000000"
                        autoComplete="one-time-code"
                        inputMode="numeric"
                      />
                      {errors.code && <p className="text-red-600 text-[10px] font-medium uppercase ml-1">{errors.code}</p>}
                    </div>
                  )}

                  {phoneOtp.requiresOtp !== false && phoneOtpStep === 'verify' && (
                    <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setPhonePasswordFallback(prev => !prev)}
                        className="text-xs font-semibold text-brand-purple hover:underline"
                      >
                        {phonePasswordFallback ? 'Use code' : 'Use password'}
                      </button>
                      <button
                        type="button"
                        onClick={onSwitchToForgotPassword}
                        className="text-[10px] text-gray-500 hover:text-brand-purple hover:underline font-medium"
                      >
                        Forgot?
                      </button>
                    </div>
                  )}

                  {phonePasswordFallback && (
                    <div className="space-y-2">
                      <Label htmlFor="phone-password" className="text-gray-700 font-medium">Password</Label>
                      <div className="relative">
                        <Input
                          id="phone-password"
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
                  )}

                  <div className="pt-1 sm:pt-2">
                    <label className="flex items-center gap-3 group cursor-pointer">
                      <Checkbox
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
                    disabled={isPhoneOtpLoading}
                    className="w-full h-10 sm:h-12 text-sm font-medium shadow-xl transition-all duration-300 transform active:scale-95 bg-brand-purple hover:bg-brand-purple/90"
                  >
                    {isPhoneOtpLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{phoneOtpStep === 'request' ? 'Sending...' : phonePasswordFallback ? 'Signing in...' : 'Verifying...'}</span>
                      </div>
                    ) : (
                      phoneOtpStep === 'request' ? 'Send Code' : phonePasswordFallback ? 'Sign In' : 'Verify & Sign In'
                    )}
                  </Button>
                  {phoneOtpStep === 'request' && (
                    <button
                      type="button"
                      onClick={handleUsePhonePassword}
                      className="w-full text-center text-sm font-semibold text-brand-purple hover:underline"
                    >
                      Use password instead
                    </button>
                  )}
            </form>
            )} {/* end loginMode !== 'student' ternary */}
            </>
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
