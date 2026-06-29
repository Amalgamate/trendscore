import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, CheckCircle, ArrowLeft, ClipboardPaste } from 'lucide-react';
import { authAPI } from '../../services/api';

export default function OTPVerificationForm({
  email,
  phone,
  onVerifySuccess,
  onBackToLogin,
  brandingSettings,
  // optional flags from server/login flow
  smsConfigured, // boolean | undefined
  autofillAllowed, // boolean | undefined
}) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef([]);

  // ── Auto-focus first input ──────────────────────────────────────────────────
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // ── Resend countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // ── Auto-submit when all 6 digits are filled ────────────────────────────────
  useEffect(() => {
    if (otp.every(digit => digit !== '') && !success && !isLoading) {
      verifyOtpCode(otp.join(''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  // ── Web OTP API — Android SMS autofill ─────────────────────────────────────
  useEffect(() => {
    // If OTPCredential isn't available, do nothing
    if (!('OTPCredential' in window)) return;

    // If caller explicitly disabled autofill, skip starting the Web OTP listener
    if (autofillAllowed === false) return;

    const controller = new AbortController();

    navigator.credentials
      .get({ otp: { transport: ['sms'] }, signal: controller.signal })
      .then((credential) => {
        if (credential?.code) {
          fillOtp(credential.code);
        }
      })
      .catch(() => {}); // silently ignore — user may deny or timeout

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autofillAllowed]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const fillOtp = (code) => {
    const digits = code.replace(/\D/g, '').slice(0, 6).split('');
    if (digits.length === 0) return;
    const newOtp = ['', '', '', '', '', ''];
    digits.forEach((d, i) => { newOtp[i] = d; });
    setOtp(newOtp);
    // Focus the next empty box or the last
    const nextEmpty = digits.length < 6 ? digits.length : 5;
    inputRefs.current[nextEmpty]?.focus();
  };

  // ── Individual input change ─────────────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    // Allow only digits; also handle paste of multiple chars in a single box
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }
    // If multiple digits typed/pasted into one box, fill forward
    if (digits.length > 1) {
      fillOtp(otp.slice(0, index).join('') + digits);
      return;
    }
    const newOtp = [...otp];
    newOtp[index] = digits[0];
    setOtp(newOtp);
    if (index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (otp[index]) {
        // Clear current box
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      } else if (index > 0) {
        // Move back and clear previous
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
      e.preventDefault();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  };

  // ── Paste handler — works even when pasting into any of the boxes ───────────
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    fillOtp(pasted);
  };

  // ── Manual paste button (fallback for mobile users who long-press) ──────────
  const handleManualPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      fillOtp(text);
    } catch {
      // Clipboard API denied — user must paste manually
    }
  };

  // ── API calls ───────────────────────────────────────────────────────────────
  const verifyOtpCode = async (otpCode) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await authAPI.verifyOTP({ email, otp: otpCode });

      setSuccess(true);
      if (response.token) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('authToken', response.token);
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
      }

      setTimeout(() => {
        onVerifySuccess(response.user || { email }, response.token, response.refreshToken);
      }, 1000);
    } catch (err) {
      setError(err.message || 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    setError('');
    try {
      await authAPI.sendOTP({ email });
      setResendTimer(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch {
      setError('Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={onBackToLogin} className="text-gray-500 hover:text-gray-700 transition">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-medium text-gray-900">Verification</h2>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-2">
          <p className="text-sm text-blue-800">
            Enter the 6-digit code sent to <span className="font-semibold">{phone}</span>
          </p>
        </div>

        {smsConfigured === false && autofillAllowed === false && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800 font-medium">SMS Not Configured. Contact Admin.</p>
          </div>
        )}
      </div>

      {/* OTP Input */}
      <div className="space-y-6">
        <div>
          <div className="flex gap-2 sm:gap-3 justify-center">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => inputRefs.current[index] = el}
                type="text"
                inputMode="numeric"
                maxLength="6"                    /* allow paste of full code into any box */
                value={digit}
                autoComplete={index === 0 ? 'one-time-code' : 'off'}   /* iOS/Android keyboard suggestion */
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={isLoading || success}
                className={`w-10 h-12 sm:w-12 sm:h-14 text-2xl font-medium text-center border-2 rounded-xl transition-all
                  ${success
                    ? 'border-green-500 bg-green-50 text-green-600'
                    : error
                      ? 'border-red-500 bg-red-50'
                      : 'border-brand-purple/20 focus:border-brand-purple focus:ring-4 focus:ring-brand-purple/10'
                  } shadow-sm`}
              />
            ))}
          </div>

          {/* Paste button — helpful on Android when autofill banner doesn't appear */}
          <div className="flex justify-center mt-3">
            <button
              type="button"
              onClick={handleManualPaste}
              disabled={isLoading || success}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-purple transition-colors disabled:opacity-40"
            >
              <ClipboardPaste size={13} />
              Paste code
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="min-h-[24px] text-center">
          {isLoading && (
            <p className="text-sm text-blue-600 flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Verifying...
            </p>
          )}
          {error && !isLoading && (
            <p className="text-sm text-red-600 flex items-center justify-center gap-1">
              <AlertCircle size={16} /> {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-600 flex items-center justify-center gap-1">
              <CheckCircle size={16} /> Verified! Redirecting...
            </p>
          )}
        </div>

        {/* Resend Timer */}
        <div className="text-center pt-4">
          <p className="text-sm text-gray-600 mb-2">Didn't receive the code?</p>
          <button
            onClick={handleResendOTP}
            disabled={isLoading || resendTimer > 0 || success}
            className="font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {resendTimer > 0
              ? `Resend in 00:${resendTimer.toString().padStart(2, '0')}`
              : 'Resend Code'}
          </button>
        </div>
      </div>
    </div>
  );
}
