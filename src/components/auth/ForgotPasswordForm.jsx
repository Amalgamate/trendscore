import React, { useState } from 'react';
import { Mail, AlertCircle, CheckCircle, ArrowLeft, Lock, Shield, Loader2 } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { cn } from "../../utils/cn";
import { PRODUCT_DISPLAY_NAME } from '../../config/productIdentity';

export default function ForgotPasswordForm({ onSwitchToLogin, brandingSettings }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validateEmail = () => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateEmail()) return;

    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setEmailSent(true);
    }, 1500);
  };

  const handleChange = (e) => {
    setEmail(e.target.value);
    if (error) setError('');
  };

  const brandColor = brandingSettings?.brandColor || 'var(--brand-purple)';

  if (emailSent) {
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

        <Card className="w-full max-w-md border-white/20 bg-white/95 backdrop-blur-xl shadow-2xl relative z-10 animate-fade-up overflow-hidden">
          <CardHeader className="pt-10 pb-6 text-center border-b border-gray-100/50">
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-50 rounded-full shadow-inner animate-in zoom-in duration-500">
                <CheckCircle className="text-green-500" size={40} />
              </div>
            </div>
            <CardTitle className="text-2xl font-medium text-gray-900">Check Your Email</CardTitle>
            <CardDescription className="text-gray-500 font-medium uppercase tracking-tight text-xs mt-1">
              Instructions sent to your inbox
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-8 text-center">
            <p className="text-gray-600 text-sm leading-relaxed">
              We've sent a password reset link to<br />
              <strong className="text-brand-purple font-semibold">{email}</strong>
            </p>

            <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-4 text-left">
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider leading-relaxed">
                💡 Tip: The link will expire in 1 hour. Check your spam folder if you don't see the email.
              </p>
            </div>

            <div className="space-y-4">
              <Button
                variant="outline"
                onClick={() => setEmailSent(false)}
                className="w-full h-12 border-gray-200 hover:bg-gray-50 font-medium text-gray-700"
              >
                Try Another Email
              </Button>
              <Button
                variant="ghost"
                onClick={onSwitchToLogin}
                className="w-full h-12 flex items-center justify-center gap-2 text-brand-purple hover:text-brand-purple hover:bg-brand-purple/5 font-medium"
              >
                <ArrowLeft size={18} />
                Back to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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

      <Card className="w-full max-w-md border-white/20 bg-white/95 backdrop-blur-xl shadow-2xl relative z-10 animate-fade-up overflow-hidden">
        <CardHeader className="pt-10 pb-6 text-center border-b border-gray-100/50">
          <div className="inline-flex flex-col items-center justify-center transform scale-90 mb-4 group">
            {brandingSettings?.logoUrl && (
              <img
                src={brandingSettings.logoUrl}
                alt="Logo"
                className="w-20 h-20 object-contain mb-4 transition-transform duration-500 group-hover:scale-110 drop-shadow-xl"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <CardTitle className="text-xl font-semibold tracking-tighter text-gray-900 uppercase">
                {brandingSettings?.schoolName || PRODUCT_DISPLAY_NAME}
            </CardTitle>
          </div>
          <CardTitle className="text-2xl font-medium text-gray-900 mt-2">Forgot Password?</CardTitle>
          <CardDescription className="text-gray-500 font-medium uppercase tracking-tight text-xs mt-1">
            We'll help you get back into your account
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700 font-medium ml-1">Email Address</Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-purple transition-colors">
                  <Mail size={18} />
                </div>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={handleChange}
                  className={cn(
                    "h-12 pl-12 border-gray-200 focus:border-brand-purple focus:ring-brand-purple/20 transition-all",
                    error && "border-red-500 bg-red-50"
                  )}
                  placeholder="you@school.com"
                  autoFocus
                />
              </div>
              {error && (
                <div className="flex items-center gap-1.5 mt-1.5 ml-1 text-red-600 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle size={14} />
                  <span className="text-[10px] font-semibold uppercase tracking-tight">{error}</span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-sm font-semibold uppercase tracking-[0.2em] shadow-xl transition-all duration-300 transform active:scale-[0.98] bg-brand-purple hover:bg-brand-purple/90"
            >
              {isLoading ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Sending...</span>
                </div>
              ) : (
                'Send Reset Link'
              )}
            </Button>

            <div className="text-center">
              <Button
                variant="ghost"
                type="button"
                onClick={onSwitchToLogin}
                className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-purple hover:bg-brand-purple/5 font-medium transition-all"
              >
                <ArrowLeft size={18} />
                Back to Sign In
              </Button>
            </div>
          </form>

          {/* Security Badges */}
          <div className="mt-8 pt-6 border-t border-gray-100/50 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium uppercase tracking-tighter">
              <Shield size={14} className="text-brand-purple/50" />
              Secure Reset
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium uppercase tracking-tighter">
              <Lock size={14} className="text-brand-purple/50" />
              Encrypted flow
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
