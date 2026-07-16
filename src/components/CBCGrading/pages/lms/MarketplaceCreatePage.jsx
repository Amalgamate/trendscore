/**
 * MarketplaceCreatePage — Create/edit marketplace listing form
 * Seller creates new listings from revision library resources
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  Loader2,
  CheckCircle,
  BookOpen,
} from 'lucide-react';
import { marketplaceAPI } from '../../../../services/api/marketplace.api';
import { lmsAPI } from '../../../../services/api/lms.api';
import { useNotifications } from '../../hooks/useNotifications';

export default function MarketplaceCreatePage({ onNavigate, pageParams }) {
  const { showSuccess, showError } = useNotifications();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    resourceId: '',
    listingType: 'FREE',
    price: 0,
    currency: 'KES',
    revenueSharePct: 70,
  });

  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const response = await lmsAPI.getResources({ limit: 100 });
      const data = response?.data ?? {};
      setResources(data.resources || data.data || []);
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to load resources';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!formData.resourceId) {
      setError('Please select a resource');
      return;
    }
    if (formData.listingType === 'PAID' && formData.price <= 0) {
      setError('Price must be greater than 0 for paid listings');
      return;
    }

    try {
      setSubmitting(true);
      const data = await marketplaceAPI.createListing(formData);

      if (data.success) {
        setSuccess(true);
        showSuccess('Listing created successfully! Awaiting approval.');
        setTimeout(() => {
          onNavigate('learning-marketplace');
        }, 2000);
      } else {
        setError(data.message || 'Failed to create listing');
      }
    } catch (err) {
      const message = err?.response?.data?.message || 'An error occurred';
      setError(message);
      showError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center space-y-4 py-12">
          <CheckCircle size={48} className="mx-auto text-emerald-600" />
          <h2 className="text-2xl font-bold text-gray-900">Listing Created!</h2>
          <p className="text-gray-600">
            Your listing has been submitted for approval. You'll be notified when it's live.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate('learning-marketplace')}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen size={28} className="text-purple-600" />
          Create New Listing
        </h1>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Title <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Advanced Math Concepts Bundle"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
              disabled={submitting}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Brief, descriptive title for your resource</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe what learners will get from this resource…"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
              rows={4}
              disabled={submitting}
            />
            <p className="text-xs text-gray-500 mt-1">Helps buyers understand what they're purchasing</p>
          </div>

          {/* Resource Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Resource <span className="text-red-600">*</span>
            </label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-purple-600" />
              </div>
            ) : (
              <select
                name="resourceId"
                value={formData.resourceId}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                disabled={submitting}
                required
              >
                <option value="">Select a resource from your library…</option>
                {resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.title}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {resources.length > 0
                ? 'Choose a resource to list for sale'
                : 'Create resources in the Revision Library first'}
            </p>
          </div>

          {/* Listing Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Type <span className="text-red-600">*</span>
              </label>
              <select
                name="listingType"
                value={formData.listingType}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                disabled={submitting}
              >
                <option value="FREE">Free</option>
                <option value="PAID">Paid</option>
                <option value="BUNDLE">Bundle</option>
                <option value="SUBSCRIPTION">Subscription</option>
              </select>
            </div>

            {/* Price (shown if PAID) */}
            {formData.listingType === 'PAID' && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Price (KES) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0"
                  min="1"
                  step="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                  disabled={submitting}
                  required={formData.listingType === 'PAID'}
                />
              </div>
            )}
          </div>

          {/* Revenue Share */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Your Revenue Share: {formData.revenueSharePct}%
            </label>
            <input
              type="range"
              name="revenueSharePct"
              value={formData.revenueSharePct}
              onChange={handleChange}
              min="0"
              max="100"
              step="5"
              className="w-full"
              disabled={submitting}
            />
            <div className="mt-2 p-3 bg-purple-50 rounded-lg text-sm">
              <p className="text-gray-700">
                {formData.listingType === 'FREE' ? (
                  <>Free resources are not applicable for revenue split</>
                ) : (
                  <>
                    <strong>Your earnings:</strong> {formData.revenueSharePct}% × KES{' '}
                    {formData.price.toLocaleString()} = KES{' '}
                    {Math.round((formData.price * formData.revenueSharePct) / 100).toLocaleString()}
                    <br />
                    <strong>Platform fee:</strong> {100 - formData.revenueSharePct}% × KES{' '}
                    {formData.price.toLocaleString()} = KES{' '}
                    {Math.round((formData.price * (100 - formData.revenueSharePct)) / 100).toLocaleString()}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => onNavigate('learning-marketplace')}
              disabled={submitting}
              className="flex-1 px-6 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Create Listing
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
        <h3 className="font-semibold text-blue-900">How it works</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ Select a resource from your Revision Library</li>
          <li>✓ Set pricing and revenue share (for paid resources)</li>
          <li>✓ Submit for approval</li>
          <li>✓ Once approved, your listing goes live in the marketplace</li>
          <li>✓ Buyers can purchase and download your resources</li>
          <li>✓ You earn a commission on each sale</li>
        </ul>
      </div>
    </div>
  );
}
