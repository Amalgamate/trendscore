/**
 * MyListings — Seller's listing management
 * Shows all seller's listings with statuses (PENDING_APPROVAL, PUBLISHED, REJECTED)
 * Actions: View details, approve (admin), reject (admin)
 */

import React, { useState, useEffect } from 'react';
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  MoreVertical,
  Trash2,
  Edit,
} from 'lucide-react';
import { marketplaceAPI } from '../../../../../services/api/marketplace.api';
import EmptyState from '../../../shared/EmptyState';

const STATUS_CONFIG = {
  PENDING_APPROVAL: { icon: Clock, color: 'bg-amber-100 text-amber-800', label: 'Pending' },
  PUBLISHED: { icon: CheckCircle, color: 'bg-emerald-100 text-emerald-800', label: 'Published' },
  REJECTED: { icon: XCircle, color: 'bg-red-100 text-red-800', label: 'Rejected' },
};

export default function MyListings({ onNavigate, onError, onSuccess, canApprove }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const res = await marketplaceAPI.getMyListings();
      const data = res?.data ?? {};
      setListings(data.data || []);
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to load listings';
      onError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const handleApprove = async (listingId) => {
    if (!window.confirm('Approve this listing?')) return;

    try {
      setActionLoading(true);
      await marketplaceAPI.approveListing(listingId);
      onSuccess('Listing approved');
      fetchListings();
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to approve';
      onError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      onError('Please provide a rejection reason');
      return;
    }

    try {
      setActionLoading(true);
      await marketplaceAPI.rejectListing(selectedListing.id, rejectReason);
      onSuccess('Listing rejected');
      setShowRejectModal(false);
      setRejectReason('');
      fetchListings();
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to reject';
      onError(message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-purple-600" />
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="No listings yet"
          description="Create your first listing to start selling resources"
          icon={CheckCircle}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Listings List */}
      <div className="space-y-3">
        {listings.map((listing) => {
          const statusConfig = STATUS_CONFIG[listing.status] || STATUS_CONFIG.PENDING_APPROVAL;
          const StatusIcon = statusConfig.icon;

          return (
            <div
              key={listing.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{listing.title}</h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {listing.description}
                  </p>
                  <div className="flex items-center gap-3 mt-3 text-sm">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusConfig.color}`}>
                      <StatusIcon size={14} />
                      {statusConfig.label}
                    </span>
                    <span className="text-gray-600">
                      Type: <span className="font-medium">{listing.listingType}</span>
                    </span>
                    <span className="text-gray-600">
                      Price: <span className="font-semibold text-purple-600">
                        {listing.listingType === 'FREE' ? 'Free' : `KES ${listing.price.toLocaleString()}`}
                      </span>
                    </span>
                  </div>
                  {listing.status === 'REJECTED' && (
                    <div className="mt-2 bg-red-50 rounded p-2 text-xs text-red-700">
                      <p><strong>Rejection reason:</strong> {listing.rejectionReason}</p>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-right text-sm">
                  <div>
                    <p className="text-gray-600">Sales</p>
                    <p className="text-xl font-bold text-gray-900">{listing.purchaseCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Downloads</p>
                    <p className="text-xl font-bold text-gray-900">{listing.downloadCount || 0}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedListing(listing);
                      setShowDetails(true);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                    title="View details"
                  >
                    <Eye size={18} className="text-gray-600" />
                  </button>
                  {canApprove && listing.status === 'PENDING_APPROVAL' && (
                    <>
                      <button
                        onClick={() => handleApprove(listing.id)}
                        disabled={actionLoading}
                        className="p-2 hover:bg-emerald-100 rounded-lg transition disabled:opacity-50"
                        title="Approve"
                      >
                        <CheckCircle size={18} className="text-emerald-600" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedListing(listing);
                          setShowRejectModal(true);
                        }}
                        className="p-2 hover:bg-red-100 rounded-lg transition"
                        title="Reject"
                      >
                        <XCircle size={18} className="text-red-600" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Reject Listing</h2>
            <p className="text-sm text-gray-600">
              Please provide a reason for rejection. This will be sent to the seller.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 text-sm"
              rows={3}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  'Reject'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetails && selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{selectedListing.title}</h2>
            <div className="space-y-2 text-sm">
              <p><strong>Description:</strong> {selectedListing.description}</p>
              <p><strong>Type:</strong> {selectedListing.listingType}</p>
              <p><strong>Price:</strong> KES {selectedListing.price.toLocaleString()}</p>
              <p><strong>Revenue Share:</strong> {selectedListing.revenueSharePct}%</p>
              <p><strong>Status:</strong> {selectedListing.status}</p>
              <p><strong>Sales:</strong> {selectedListing.purchaseCount}</p>
              <p><strong>Downloads:</strong> {selectedListing.downloadCount}</p>
              {selectedListing.rating && (
                <p><strong>Rating:</strong> {selectedListing.rating.toFixed(1)}/5 ({selectedListing.ratingCount} ratings)</p>
              )}
            </div>
            <button
              onClick={() => setShowDetails(false)}
              className="w-full px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
