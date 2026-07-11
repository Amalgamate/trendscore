/**
 * MyPurchases — Buyer's purchase history and downloads
 * Shows completed purchases with download access, ratings
 */

import React, { useState, useEffect } from 'react';
import {
  Download,
  Star,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  ShoppingCart,
} from 'lucide-react';
import { marketplaceAPI } from '../../../../../services/api/marketplace.api';
import EmptyState from '../../../shared/EmptyState';

const STATUS_COLORS = {
  PENDING: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-gray-100 text-gray-800',
};

export default function MyPurchases({ onNavigate, onError, onSuccess }) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadLoading, setDownloadLoading] = useState({});
  const [ratingState, setRatingState] = useState({});

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const res = await marketplaceAPI.getMyPurchases();
      const data = res?.data ?? {};
      setPurchases(data.data || []);
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to load purchases';
      onError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const handleDownload = async (purchaseId) => {
    try {
      setDownloadLoading((prev) => ({ ...prev, [purchaseId]: true }));
      const res = await marketplaceAPI.downloadPurchasedResource(purchaseId);
      const data = res?.data ?? {};

      if (data.data?.url) {
        // Open download URL in new tab
        window.open(data.data.url, '_blank');
        onSuccess('Download started');
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to generate download link';
      onError(message);
    } finally {
      setDownloadLoading((prev) => ({ ...prev, [purchaseId]: false }));
    }
  };

  const handleRate = async (purchaseId, rating) => {
    try {
      setRatingState((prev) => ({ ...prev, [purchaseId]: 'loading' }));
      await marketplaceAPI.rateResource(purchaseId, rating);
      onSuccess('Rating submitted');
      setRatingState((prev) => ({ ...prev, [purchaseId]: 'done' }));
      setTimeout(() => {
        fetchPurchases();
      }, 1000);
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to submit rating';
      onError(message);
      setRatingState((prev) => ({ ...prev, [purchaseId]: null }));
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-purple-600" />
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="No purchases yet"
          description="Browse the marketplace to find and purchase educational resources"
          icon={ShoppingCart}
        />
      </div>
    );
  }

  const completed = purchases.filter((p) => p.status === 'COMPLETED');
  const pending = purchases.filter((p) => p.status === 'PENDING');
  const failed = purchases.filter((p) => p.status === 'FAILED');

  return (
    <div className="p-6 space-y-8">
      {/* Completed Purchases */}
      {completed.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle size={20} className="text-emerald-600" />
            Completed Purchases ({completed.length})
          </h3>
          <div className="space-y-3">
            {completed.map((purchase) => (
              <div
                key={purchase.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">
                      {purchase.listing?.title}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Seller: {purchase.listing?.seller?.firstName} {purchase.listing?.seller?.lastName}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <span className="text-gray-600">
                        Purchased: {new Date(purchase.purchasedAt).toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle size={12} />
                        Completed
                      </span>
                    </div>

                    {/* Rating Section */}
                    {ratingState[purchase.id] !== 'done' && !purchase.listing?.ratingCount && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-gray-600">Rate this resource:</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              onClick={() => handleRate(purchase.id, rating)}
                              disabled={ratingState[purchase.id] === 'loading'}
                              className="p-1 transition disabled:opacity-50"
                              title={`Rate ${rating} stars`}
                            >
                              <Star
                                size={16}
                                className={
                                  ratingState[purchase.id] === 'loading'
                                    ? 'text-gray-300'
                                    : 'text-amber-400 hover:fill-amber-400 cursor-pointer'
                                }
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {ratingState[purchase.id] === 'done' && (
                      <p className="text-xs text-emerald-700 mt-2">✓ Rating submitted</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="text-right text-sm">
                    <p className="text-gray-600">Price</p>
                    <p className="text-lg font-bold text-gray-900">
                      KES {purchase.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Downloads: {purchase.downloadCount}/{purchase.maxDownloads}
                    </p>
                  </div>

                  {/* Download Button */}
                  {purchase.downloadCount < purchase.maxDownloads && (
                    <button
                      onClick={() => handleDownload(purchase.id)}
                      disabled={downloadLoading[purchase.id]}
                      className="p-2 bg-purple-100 hover:bg-purple-200 rounded-lg transition disabled:opacity-50 flex-shrink-0"
                      title="Download resource"
                    >
                      {downloadLoading[purchase.id] ? (
                        <Loader2 size={18} className="animate-spin text-purple-600" />
                      ) : (
                        <Download size={18} className="text-purple-600" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Purchases */}
      {pending.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={20} className="text-amber-600" />
            Pending Purchases ({pending.length})
          </h3>
          <div className="space-y-3">
            {pending.map((purchase) => (
              <div key={purchase.id} className="border border-amber-200 rounded-lg p-4 bg-amber-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">
                      {purchase.listing?.title}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Complete the M-Pesa payment on your phone to finish this purchase.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 flex-shrink-0">
                    <Clock size={12} />
                    Awaiting Payment
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed Purchases */}
      {failed.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <XCircle size={20} className="text-red-600" />
            Failed Purchases ({failed.length})
          </h3>
          <div className="space-y-3">
            {failed.map((purchase) => (
              <div key={purchase.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">
                      {purchase.listing?.title}
                    </h4>
                    <p className="text-sm text-red-700 mt-1">
                      Payment failed. Please try purchasing again.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 flex-shrink-0">
                    <XCircle size={12} />
                    Failed
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
