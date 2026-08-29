import React, { useState, useMemo } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { authAPI } from '../../services/api/auth.api';
import { PRODUCT_DISPLAY_NAME } from '../../config/productIdentity';

export default function ResetPasswordForm({ onResetSuccess }) {
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Detect whether this is the post-login force-change flow
  const isForceChange = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('token') === 'INITIAL_SETUP_REQUIRED';
  }, []);

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
    // Force-change path uses parent-friendly policy (min 6 chars, no special chars required).
    // Regular reset path keeps the stricter default policy.
    const minLength = isForceChange ? 6 : 8;

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < minLength) {
      newErrors.password = `Password must be at least ${minLength} characters`;
    } else if (formData.password.toLowerCase() === 'changeme') {
      newErrors.password = 'Please choose a different password';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      let response;

      if (isForceChange) {
        // Authenticated flow: session cookie is present, no token needed
        response = await authAPI.changePassword(formData.password, formData.confirmPassword);
      } else {
        const searchParams = new URLSearchParams(window.location.search);
        const token = searchParams.get('token');
        if (!token) {
          setErrors({ form: 'Missing reset token. Please check your link.' });
          setIsLoading(false);
          return;
        }
        response = await authAPI.resetPassword(token, formData.password, formData.confirmPassword);
      }

      if (response.success) {
        onResetSuccess();
      } else {
        setErrors({ form: response.message || 'Failed to reset password' });
      }
    } catch (err) {
      setErrors({ form: err.message || 'Network error while resetting password' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl mb-4 transform hover:scale-105 transition-transform duration-500">
          <span className="text-3xl font-semibold tracking-tighter flex items-center gap-1">
            <span className="text-[var(--brand-purple)]">Trend</span>
            <span className="text-teal-600 font-light">Score</span>
          </span>
        </div>
        <h1 className="text-3xl font-medium text-gray-900 mb-2">
          {isForceChange ? 'Set Your Password' : 'Reset Password'}
        </h1>
        <p className="text-gray-600">
          {isForceChange
            ? 'Your account was set up with a temporary password. Please choose a new one to continue.'
            : `Create a new strong password for your ${PRODUCT_DISPLAY_NAME} account`}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8">
        {/* Force-change informational banner */}
        {isForceChange && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Welcome to the Parent Portal</p>
              <p>Your temporary password was <strong>changeme</strong>. You must set a new password before you can access your child's reports and information.</p>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-[var(--brand-purple)] focus:border-transparent transition ${errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {formData.password && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">Password strength:</span>
                  <span className={`text-xs font-semibold ${passwordStrength.strength === 4 ? 'text-green-600' :
                    passwordStrength.strength === 3 ? 'text-[#14B8A6]' :
                      passwordStrength.strength === 2 ? 'text-yellow-600' :
                        'text-red-600'
                    }`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${passwordStrength.color}`}
                    style={{ width: `${(passwordStrength.strength / 4) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {errors.password && (
              <div className="flex items-center gap-1 mt-1 text-red-600 text-sm">
                <AlertCircle size={14} />
                <span>{errors.password}</span>
              </div>
            )}
            <div className="mt-2 space-y-1">
              <p className="text-xs text-gray-500">Password must contain:</p>
              <ul className="text-xs text-gray-500 space-y-1 ml-4">
                <li className={formData.password.length >= (isForceChange ? 6 : 8) ? 'text-green-600' : ''}>
                  ✓ At least {isForceChange ? 6 : 8} characters
                </li>
                {!isForceChange && (
                  <>
                    <li className={/[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password) ? 'text-green-600' : ''}>
                      ✓ Uppercase and lowercase letters
                    </li>
                    <li className={/[^a-zA-Z0-9]/.test(formData.password) ? 'text-green-600' : ''}>
                      ✓ At least one special character
                    </li>
                  </>
                )}
                <li className={/\d/.test(formData.password) ? 'text-green-600' : ''}>
                  ✓ At least one number
                </li>
              </ul>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-[var(--brand-purple)] focus:border-transparent transition ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="Re-enter new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {formData.confirmPassword && formData.password === formData.confirmPassword && (
              <div className="flex items-center gap-1 mt-1 text-green-600 text-sm">
                <CheckCircle size={14} />
                <span>Passwords match</span>
              </div>
            )}
            {errors.confirmPassword && (
              <div className="flex items-center gap-1 mt-1 text-red-600 text-sm">
                <AlertCircle size={14} />
                <span>{errors.confirmPassword}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[var(--brand-purple)] text-white py-3 rounded-lg font-semibold hover:bg-[#3D0038] focus:ring-4 focus:ring-[var(--brand-purple)]/20 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{isForceChange ? 'Saving...' : 'Resetting Password...'}</span>
              </div>
            ) : (
              isForceChange ? 'Set My Password' : 'Reset Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
