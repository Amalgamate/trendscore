/**
 * Parent Portal Documents Screen
 * Browse and download school documents (circulars, reports, certificates, etc.)
 * Data: documentsAPI.getAll({ category, search }), documentsAPI.getCategories()
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, FileText, Search, Download, RefreshCw, AlertCircle,
  File, FileSpreadsheet, Image as ImageIcon, X,
} from 'lucide-react';
import { documentsAPI } from '../../../../services/api';
import { Skeleton } from '../../../ui';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getFileIcon(type = '') {
  const t = String(type).toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(t)) return ImageIcon;
  if (['xls', 'xlsx', 'csv'].includes(t)) return FileSpreadsheet;
  if (['pdf', 'doc', 'docx', 'txt'].includes(t)) return FileText;
  return File;
}

function formatSize(bytes) {
  const n = Number(bytes || 0);
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCategoryLabel(cat) {
  if (!cat) return 'General';
  return cat
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Document Card ──────────────────────────────────────────────────────────

function DocumentCard({ doc }) {
  const Icon = getFileIcon(doc.type);

  const handleOpen = () => {
    if (doc.url) window.open(doc.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3.5 text-left hover:border-blue-300 hover:bg-blue-50/30 transition"
    >
      <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{doc.name}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {formatCategoryLabel(doc.category)}
          </span>
          <span className="text-[11px] text-gray-400">{formatSize(doc.size)}</span>
          <span className="text-[11px] text-gray-400">·</span>
          <span className="text-[11px] text-gray-400">{formatDate(doc.createdAt)}</span>
        </div>
      </div>
      <Download size={16} className="text-gray-400 flex-shrink-0" />
    </button>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

const ParentPortalDocuments = ({ onNavigate }) => {
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  const load = useCallback(async (category, searchTerm) => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (category && category !== 'all') params.category = category;
      if (searchTerm?.trim()) params.search = searchTerm.trim();
      const res = await documentsAPI.getAll(params);
      if (res?.success) {
        setDocuments(res.data || []);
      } else {
        setError(res?.message || 'Failed to load documents');
      }
    } catch (e) {
      setError(e?.message || 'Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + category list
  useEffect(() => {
    load('all', '');
    documentsAPI.getCategories()
      .then((res) => { if (res?.success) setCategories(res.data || []); })
      .catch(() => {});
  }, [load]);

  // Reload when category changes
  useEffect(() => {
    load(selectedCategory, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // Debounced search
  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(selectedCategory, val), 350);
  };

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => onNavigate('parent-portal-more')}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">Documents</h1>
            <p className="text-[10px] text-gray-500">View and download school files</p>
          </div>
          <button
            type="button"
            onClick={() => load(selectedCategory, search)}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 h-10">
            <Search size={15} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search documents…"
              className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
            />
            {search && (
              <button type="button" onClick={() => handleSearchChange('')} className="text-gray-400">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {formatCategoryLabel(cat)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pt-4 space-y-2.5">
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-600 flex-shrink-0" />
            <p className="text-xs text-rose-700 flex-1">{error}</p>
            <button
              type="button"
              onClick={() => load(selectedCategory, search)}
              className="text-[10px] text-rose-600 font-bold underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : documents.length > 0 ? (
          documents.map((doc) => <DocumentCard key={doc.id} doc={doc} />)
        ) : (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
            <FileText size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700 mb-1">
              {search || selectedCategory !== 'all' ? 'No matching documents' : 'No documents yet'}
            </p>
            <p className="text-xs text-gray-400">
              {search || selectedCategory !== 'all'
                ? 'Try a different search term or category.'
                : 'Report cards, certificates, and circulars will appear here once shared by the school.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentPortalDocuments;
