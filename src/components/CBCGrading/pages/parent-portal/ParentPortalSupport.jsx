/**
 * Parent Portal Support Screen
 * Help and support center
 */

import React from 'react';
import { ArrowLeft, HelpCircle, MessageSquare, Phone, Mail } from 'lucide-react';

const ParentPortalSupport = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => onNavigate('parent-portal-more')}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition text-gray-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Support</h1>
            <p className="text-xs text-gray-500">Help center</p>
          </div>
          <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
            <HelpCircle size={20} />
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
          <HelpCircle size={40} className="mx-auto mb-3 text-gray-300" />
          <h3 className="font-semibold text-gray-900 mb-1">Support Coming Soon</h3>
          <p className="text-sm text-gray-500">Help center and FAQs will be available soon</p>
        </div>

        {/* Contact options */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 px-1">Get Help Now</h3>
          
          <button className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <MessageSquare size={18} />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-gray-900 text-sm">Chat Support</p>
              <p className="text-xs text-gray-500">Available 9 AM - 5 PM</p>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Phone size={18} />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-gray-900 text-sm">Call Us</p>
              <p className="text-xs text-gray-500">+254 712 345 678</p>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <Mail size={18} />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-gray-900 text-sm">Email Support</p>
              <p className="text-xs text-gray-500">support@school.ac.ke</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParentPortalSupport;
