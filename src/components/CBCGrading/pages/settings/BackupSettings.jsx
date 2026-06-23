/**
 * Backup Settings Page — connected to real backend API
 */

import React, { useState, useEffect, useRef } from 'react';
import { Download, Upload, RefreshCw, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import axiosInstance from '../../../../services/api/axiosConfig';

function apiErrorMessage(err, fallback) {
  const status = err?.response?.status;
  const raw = err?.response?.data?.error;
  if (status === 429) {
    const msg = typeof raw === 'object' && raw?.message ? raw.message : 'Too many attempts. Wait a minute and try again.';
    return msg;
  }
  if (typeof raw === 'string' && raw.trim()) return raw;
  if (typeof raw === 'object' && raw?.message) return raw.message;
  return fallback;
}

const BackupSettings = () => {
  const { showSuccess, showError } = useNotifications();

  const [backups, setBackups] = useState([]);
  const [summary, setSummary] = useState({ lastBackupFormatted: '—', total: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const fileInputRef = useRef(null);

  // ── Fetch backup list ───────────────────────────────────────────────────────
  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/backup');
      if (res.data.success) {
        setBackups(res.data.data.backups);
        setSummary({
          lastBackupFormatted: res.data.data.lastBackupFormatted,
          total: res.data.data.total,
        });
      }
    } catch (err) {
      showError('Failed to load backup list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBackups(); }, []);

  // ── Create backup ───────────────────────────────────────────────────────────
  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      const res = await axiosInstance.post('/backup');
      if (res.data.success) {
        showSuccess(`Backup created! (${res.data.message})`);
        await fetchBackups();
      }
    } catch (err) {
      showError(apiErrorMessage(err, 'Backup failed. Check server logs and ensure PostgreSQL client tools (pg_dump) are installed.'));
    } finally {
      setCreating(false);
    }
  };

  // ── Download backup ─────────────────────────────────────────────────────────
  const handleDownload = async (filename) => {
    try {
      setDownloadingId(filename);
      const res = await axiosInstance.get(`/backup/download/${encodeURIComponent(filename)}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showSuccess(`Downloading ${filename}`);
    } catch (err) {
      showError('Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Delete backup ───────────────────────────────────────────────────────────
  const handleDelete = async (filename) => {
    if (!window.confirm(`Delete backup "${filename}"? This cannot be undone.`)) return;
    try {
      setDeletingId(filename);
      await axiosInstance.delete(`/backup/${encodeURIComponent(filename)}`);
      showSuccess('Backup deleted');
      await fetchBackups();
    } catch (err) {
      showError(err?.response?.data?.error || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Restore backup ──────────────────────────────────────────────────────────
  const handleRestore = async () => {
    if (!restoreFile) {
      showError('Please choose a .sql or .sql.gz file first');
      return;
    }
    if (!window.confirm('This will REPLACE ALL current data with the backup. Are you absolutely sure?')) return;

    try {
      setRestoring(true);
      const formData = new FormData();
      formData.append('file', restoreFile);
      const res = await axiosInstance.post('/backup/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000, // restore can take a while
      });
      if (res.data.success) {
        showSuccess(res.data.message || 'Database restored successfully');
        setRestoreFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err) {
      showError(err?.response?.data?.error || 'Restore failed. Check server logs.');
    } finally {
      setRestoring(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Action Toolbar */}
      <div className="toolbar-card flex justify-end">
        <button
          onClick={handleCreateBackup}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {creating
            ? <><Loader2 size={18} className="animate-spin" /> Creating…</>
            : <><RefreshCw size={18} /> Create Backup</>
          }
        </button>
      </div>

      {/* Info panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-medium text-blue-900 mb-2">About Backups</h3>
        <p className="text-blue-800 mb-4 max-w-3xl">
          Regular backups ensure your data is safe. Backups include all learner records, assessments, and system settings.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-3xl mx-auto">
          <div className="bg-white rounded-lg p-4 border border-blue-100/80 flex flex-col justify-center min-h-[5.5rem]">
            <p className="text-sm font-semibold text-gray-600">Last Backup</p>
            <p className="text-lg font-medium text-gray-900 mt-1">
              {loading ? '—' : summary.lastBackupFormatted}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-100/80 flex flex-col justify-center min-h-[5.5rem]">
            <p className="text-sm font-semibold text-gray-600">Total Backups</p>
            <p className="text-lg font-medium text-gray-900 mt-1">
              {loading ? '—' : `${summary.total} Backup${summary.total !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
      </div>

      {/* Restore Section */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-medium mb-4">Restore from Backup</h3>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 flex items-start gap-3">
          <AlertCircle size={22} className="text-orange-500 mt-0.5 shrink-0" />
          <p className="text-orange-800 text-sm">
            Restoring from a backup will replace all current data. This action cannot be undone.
            Please ensure you have a recent backup before proceeding.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-h-10 flex-1 min-w-0 items-center rounded-lg border border-gray-300 bg-white px-3 py-1 shadow-sm sm:h-10 sm:py-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".sql,.gz"
              onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
              className="w-full min-w-0 cursor-pointer text-sm text-gray-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-800 hover:file:bg-gray-200"
            />
          </div>
          <button
            type="button"
            onClick={handleRestore}
            disabled={restoring || !restoreFile}
            className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-orange-600 px-6 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {restoring
              ? <><Loader2 size={16} className="animate-spin" /> Restoring…</>
              : <><Upload size={16} /> Restore Backup</>
            }
          </button>
        </div>
      </div>

      {/* Backup History */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h3 className="text-lg font-medium">Backup History</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={28} className="animate-spin mr-2" /> Loading backups…
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No backups yet</p>
            <p className="text-sm mt-1">Click "Create Backup" to make your first one.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-[color:var(--table-border)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[color:var(--table-header-fg)] uppercase">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[color:var(--table-header-fg)] uppercase">Size</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[color:var(--table-header-fg)] uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[color:var(--table-header-fg)] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {backups.map((backup) => (
                <tr key={backup.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-semibold text-gray-800">{backup.date}</td>
                  <td className="px-6 py-4 text-gray-600">{backup.size}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
                      backup.type === 'Auto'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}>{backup.type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownload(backup.filename)}
                        disabled={downloadingId === backup.filename}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
                        title="Download"
                      >
                        {downloadingId === backup.filename
                          ? <Loader2 size={16} className="animate-spin" />
                          : <Download size={18} />
                        }
                      </button>
                      <button
                        onClick={() => handleDelete(backup.filename)}
                        disabled={deletingId === backup.filename}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === backup.filename
                          ? <Loader2 size={16} className="animate-spin" />
                          : <Trash2 size={18} />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Auto Backup Info */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-medium mb-2">Automatic Backup Schedule</h3>
        <p className="text-sm text-gray-600 mb-4">
          Automatic backups run every 24 hours via a cron job on the server.
          Backups older than 14 days are automatically deleted.
        </p>
        <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm text-gray-700 border border-gray-200">
          <p className="font-semibold text-gray-500 text-xs uppercase mb-2">Cron Expression (runs at 2:00 AM daily)</p>
          <code>0 2 * * * cd /path/to/server && node tools/scripts/backup-db.js &gt;&gt; logs/backup.log 2&gt;&amp;1</code>
        </div>
      </div>

    </div>
  );
};

export default BackupSettings;
