/**
 * MarketplacePage — Unified marketplace hub
 * Tabs: Browse | My Listings | My Purchases
 * Browse shows all published listings, My Listings shows seller's listings (all statuses),
 * My Purchases shows buyer's purchase history and downloads
 */

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Store,
  ShoppingCart,
  BarChart3,
  Plus,
  Loader,
  AlertCircle,
} from 'lucide-react';
import { marketplaceAPI } from '../../../../services/api/marketplace.api';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../../../hooks/useAuth';
import { usePermissions } from '../../../../hooks/usePermissions';
import EmptyState from '../../shared/EmptyState';

// Import tab components
import BrowseListings from './marketplace/BrowseListings';
import MyListings from './marketplace/MyListings';
import MyPurchases from './marketplace/MyPurchases';
import SellerAnalytics from './marketplace/SellerAnalytics';

const TABS = [
  { id: 'browse', label: 'Browse Marketplace', icon: Store },
  { id: 'my-listings', label: 'My Listings', icon: BookOpen },
  { id: 'my-purchases', label: 'My Purchases', icon: ShoppingCart },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export default function MarketplacePage({ onNavigate }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { showSuccess, showError } = useNotifications();

  const [activeTab, setActiveTab] = useState('browse');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Permission checks
  // Sellers are users who can publish marketplace listings
  const canSell = can('MARKETPLACE_PUBLISH') || can('LEARNING_MANAGE');
  const canApprove = can('MARKETPLACE_APPROVE') || can('LEARNING_MANAGE');

  const handleCreateListing = () => {
    onNavigate('learning-marketplace-create');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Store size={28} className="text-purple-600" />
            Content Marketplace
          </h1>
          <p className="text-sm text-gray-600 mt-1">Buy and sell educational resources</p>
        </div>
        {canSell && activeTab === 'my-listings' && (
          <button
            onClick={handleCreateListing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
          >
            <Plus size={18} />
            Create Listing
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-white rounded-t-lg">
        <div className="flex flex-wrap">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            // Hide tabs based on permissions
            if ((tab.id === 'my-listings' || tab.id === 'analytics') && !canSell) {
              return null;
            }
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition ${
                  isActive
                    ? 'border-purple-600 text-purple-600 bg-purple-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader size={24} className="animate-spin text-purple-600" />
        </div>
      )}

      {/* Tab Content */}
      {!loading && !error && (
        <div className="bg-white rounded-b-lg rounded-t-none">
          {activeTab === 'browse' && (
            <BrowseListings
              onNavigate={onNavigate}
              onError={setError}
              onSuccess={showSuccess}
            />
          )}

          {activeTab === 'my-listings' && canSell && (
            <MyListings
              onNavigate={onNavigate}
              onError={setError}
              onSuccess={showSuccess}
              canApprove={canApprove}
            />
          )}

          {activeTab === 'my-purchases' && (
            <MyPurchases
              onNavigate={onNavigate}
              onError={setError}
              onSuccess={showSuccess}
            />
          )}

          {activeTab === 'analytics' && canSell && (
            <SellerAnalytics
              onError={setError}
              onSuccess={showSuccess}
            />
          )}
        </div>
      )}
    </div>
  );
}
