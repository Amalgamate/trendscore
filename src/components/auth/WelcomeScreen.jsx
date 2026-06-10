import React from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { PRODUCT_DISPLAY_NAME } from '../../config/productIdentity';

export default function WelcomeScreen({ user, onGetStarted, brandingSettings }) {
  return (
    <div
      className="w-full h-screen flex items-center justify-center p-4 overflow-hidden relative"
      style={{ backgroundColor: brandingSettings?.brandColor || 'var(--brand-purple)' }}
    >
      {/* Decorative Blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-teal/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

      {/* Simple centered content */}
      <div className="text-center px-6 max-w-2xl">
        <div className="mb-12 text-center">
          <div className="inline-flex flex-col items-center justify-center p-4 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 shadow-2xl mb-8 transform hover:scale-105 transition-transform duration-500">
            {brandingSettings?.logoUrl && (
              <img
                src={brandingSettings.logoUrl}
                alt="Logo"
                className="w-28 h-28 object-contain mb-6"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <span className="text-2xl sm:text-4xl lg:text-5xl font-semibold tracking-tighter text-white whitespace-nowrap uppercase">
              {brandingSettings?.schoolName || PRODUCT_DISPLAY_NAME}
            </span>
          </div>
        </div>

        {/* Success Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-6 shadow-lg">
          <CheckCircle className="text-green-500" size={40} />
        </div>

        {/* Welcome Message */}
        <h1 className="text-4xl lg:text-5xl font-medium text-white mb-4 drop-shadow-sm">
          Welcome, {user?.name || 'User'}!
        </h1>
        <p className="text-xl text-white/80 mb-10 leading-relaxed max-w-lg mx-auto">
          Your account has been successfully created. We're excited to have you on board!
        </p>

        {/* Get Started Button */}
        <button
          onClick={onGetStarted}
          className="group inline-flex items-center gap-3 bg-white text-brand-purple px-10 py-4 rounded-2xl font-medium text-xl hover:bg-white/90 transition-all shadow-2xl hover:shadow-brand-teal/20 hover:scale-105 active:scale-95"
        >
          Get Started
          <ArrowRight className="group-hover:translate-x-1 transition-transform" size={24} />
        </button>

        {/* Footer */}
        <p className="text-white/40 text-sm mt-12 font-medium tracking-wide">
          © {new Date().getFullYear()} {brandingSettings?.schoolName || PRODUCT_DISPLAY_NAME} • CBC Grading System
        </p>
      </div>
    </div>
  );
}
