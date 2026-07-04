/**
 * BrowseListings — Market browsing interface
 * Filters: Type, Price Range, Search
 * Pagination support
 * Purchase modal for each listing
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Star,
  ShoppingCart,
  Loader2,
  DollarSign,
  Users,
  Download,
} from 'lucide-react';
import { marketplaceAPI } from '../../../../../services/api/marketplace.api';
import EmptyState from '../../../shared/EmptyState';
import ListingCard from './ListingCard';
import PurchaseModal from './PurchaseModal';

export default function BrowseListings({ onNavigate, onError, onSuccess }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [listingType, setListingType] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Purchase modal
  const [selectedListing, setSelectedListing] = useState(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const fetchListings = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', 12);
      if (search) params.set('search', search);
      if (listingType) params.set('type', listingType);
      if (priceMin) params.set('priceMin', priceMin);
      if (priceMax) params.set('priceMax', priceMax);

      const res = await marketplaceAPI.browseListings(Object.fromEntries(params));
      const data = res?.data ?? {};

      setListings(data.listings || []);
      setPagination({
        page: data.page || page,
        pages: data.pages || 1,
        total: data.total || 0,
      });
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to load listings';
      onError(message);
      console.error('Fetch listings error:', error);
    } finally {
      setLoading(false);
    }
  }, [search, listingType, priceMin, priceMax, onError]);

  useEffect(() => {
    fetchListings(1);
  }, [fetchListings]);

  const handlePurchaseClick = (listing) => {
    setSelectedListing(listing);
    setShowPurchaseModal(true);
  };

  const handlePurchaseSuccess = () => {
    setShowPurchaseModal(false);
    setSelectedListing(null);
    onSuccess('Purchase initiated! You will receive a payment prompt on your phone.');
    fetchListings(1);
  };

  const setError = (err) => {
    onError(err);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Search & Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search listings…"
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg font-medium transition ${
              showFilters
                ? 'bg-purple-50 border-purple-300 text-purple-700'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter size={18} />
            Filters
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={listingType}
                onChange={(e) => setListingType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                <option value="">All Types</option>
                <option value="FREE">Free</option>
                <option value="PAID">Paid</option>
                <option value="BUNDLE">Bundle</option>
                <option value="SUBSCRIPTION">Subscription</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Min Price (KES)</label>
              <input
                type="number"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Price (KES)</label>
              <input
                type="number"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="999999"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{listings.length}</span> of{' '}
          <span className="font-semibold">{pagination.total}</span> listings
        </p>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-purple-600" />
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          title="No listings found"
          description={search ? 'Try adjusting your search or filters' : 'Check back soon for new educational resources'}
          icon={ShoppingCart}
        />
      ) : (
        <>
          {/* Listings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onPurchase={handlePurchaseClick}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.pages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchListings(Math.max(1, pagination.page - 1))}
                  disabled={pagination.page === 1}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => fetchListings(Math.min(pagination.pages, pagination.page + 1))}
                  disabled={pagination.page === pagination.pages}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Purchase Modal */}
      {showPurchaseModal && selectedListing && (
        <PurchaseModal
          listing={selectedListing}
          onClose={() => {
            setShowPurchaseModal(false);
            setSelectedListing(null);
          }}
          onSuccess={handlePurchaseSuccess}
          onError={onError}
        />
      )}
    </div>
  );
}
