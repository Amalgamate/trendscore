/**
 * SellerAnalytics — Marketplace analytics for sellers
 * Shows total sales, revenue, top listings, download counts
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Download,
  BookOpen,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { marketplaceAPI } from '../../../../../services/api/marketplace.api';

export default function SellerAnalytics({ onError, onSuccess }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await marketplaceAPI.getMarketplaceAnalytics();
      const data = res?.data ?? {};
      setAnalytics(data);
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to load analytics';
      onError(message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-purple-600" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="text-yellow-600 flex-shrink-0" size={20} />
          <div>
            <h3 className="font-semibold text-yellow-900">No analytics available</h3>
            <p className="text-sm text-yellow-700">Create listings and get sales to see analytics.</p>
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Sales',
      value: analytics.totalSales || 0,
      icon: ShoppingCart,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Revenue Earned',
      value: `KES ${(analytics.revenueEarned || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Total Downloads',
      value: analytics.totalDownloads || 0,
      icon: Download,
      color: 'bg-purple-100 text-purple-600',
    },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="border border-gray-200 rounded-lg p-6 bg-white hover:shadow-md transition"
            >
              <div className={`inline-flex p-3 rounded-lg mb-4 ${stat.color}`}>
                <Icon size={24} />
              </div>
              <p className="text-sm text-gray-600 mb-2">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Top Listings */}
      {analytics.topListings && analytics.topListings.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-purple-600" />
            Top Performing Listings
          </h3>
          <div className="space-y-3">
            {analytics.topListings.map((listing, index) => (
              <div
                key={listing.listingId}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-semibold text-sm">
                        #{index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">{listing.title}</h4>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {listing.sales} sales
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{listing.sales}</p>
                    <p className="text-xs text-gray-500">Sales</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!analytics.topListings || analytics.topListings.length === 0) && (
        <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
          <BookOpen size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">Create listings and start selling to see your top performers here</p>
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-center">
        <button
          onClick={fetchAnalytics}
          className="px-6 py-2 border border-purple-300 text-purple-700 font-medium rounded-lg hover:bg-purple-50 transition"
        >
          Refresh Analytics
        </button>
      </div>
    </div>
  );
}
