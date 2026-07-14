/**
 * PurchaseModal — STK push initiated purchase flow
 * Shows listing details + phone input → triggers M-Pesa STK push
 */

import React, { useState } from 'react';
import {
  X,
  DollarSign,
  Phone,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { marketplaceAPI } from '../../../../../services/api/marketplace.api';
import { useAuth } from '../../../../../hooks/useAuth';

export default function PurchaseModal({ listing, onClose, onSuccess, onError }) {
  const { user } = useAuth();
  const isFree = listing?.listingType === 'FREE' || Number(listing?.price || 0) <= 0;
  const [phone, setPhone] = useState(user?.phone || '');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Paid listings require a valid M-Pesa phone number; FREE listings do not.
    if (!isFree && (!phone || !phone.match(/^254\d{9}$/))) {
      setError('Please enter a valid Kenyan phone number (254...)');
      return;
    }

    try {
      setLoading(true);
      const res = await marketplaceAPI.initiatePurchase(
        listing.id,
        isFree ? undefined : phone,
        firstName,
        lastName
      );
      const data = res?.data ?? {};

      if (data.success) {
        // For free listings we can auto-download after access is granted.
        if (isFree && data.data?.purchaseId) {
          try {
            const dl = await marketplaceAPI.downloadPurchasedResource(data.data.purchaseId);
            const url = dl?.data?.data?.url;
            if (url) window.open(url, '_blank');
          } catch (dlErr) {
            // Non-fatal: user can still download later from "My Purchases"
          }
        }
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        setError(data.message || 'Failed to initiate purchase');
      }
    } catch (err) {
      const message = err?.response?.data?.message || 'An error occurred during purchase';
      setError(message);
      onError(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full text-center space-y-4">
          <CheckCircle size={48} className="mx-auto text-emerald-600" />
          <h2 className="text-xl font-bold text-gray-900">Purchase Initiated!</h2>
          <p className="text-gray-600">
            You will receive an M-Pesa prompt on your phone. Complete the payment to confirm your purchase.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Purchase Resource</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Listing Summary */}
          <div className="bg-purple-50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-gray-900">{listing.title}</h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Seller:</span>
              <span className="font-medium">
                {listing.seller?.firstName} {listing.seller?.lastName}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-purple-200">
              <span className="text-gray-600 font-medium">Total:</span>
              <span className="text-xl font-bold text-purple-600">
                {listing.currency === 'KES' ? 'KES ' : ''}
                {listing.price.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="text-red-600 flex-shrink-0" size={18} />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Phone Number */}
          {!isFree ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone size={16} className="inline mr-1" />
                Phone Number (M-Pesa)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="254712345678"
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-gray-50"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Format: 254712345678 (Kenyan number)</p>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
              This is a free resource. You'll get access immediately and the download will start.
            </div>
          )}

          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <DollarSign size={18} />
                  {isFree ? 'Get Access' : `Pay KES ${listing.price.toLocaleString()}`}
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            {isFree
              ? "You'll be redirected to download immediately."
              : "You'll receive an M-Pesa prompt on your phone to complete the payment."}
          </p>
        </form>
      </div>
    </div>
  );
}
