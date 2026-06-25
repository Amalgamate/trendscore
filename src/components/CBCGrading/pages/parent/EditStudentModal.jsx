/**
 * EditStudentModal
 * Allows a parent to update their child's display name and profile photo.
 * Uses learnerAPI.parentUpdate() which calls PATCH /api/learners/:id/parent-update
 * Photo is encoded as base64 and sent in the `photo` field.
 */
import React, { useState, useRef, useCallback } from 'react';
import { X, Camera, Loader2, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';
import { learnerAPI } from '../../../../services/api';

const MAX_PHOTO_SIZE_MB = 5;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function EditStudentModal({ child, brandingSettings, onClose, onSaved }) {
  const [firstName, setFirstName] = useState((child.name || '').split(' ')[0] || '');
  const [lastName, setLastName] = useState((child.name || '').split(' ').slice(1).join(' ') || '');
  const [photoPreview, setPhotoPreview] = useState(child.photo || child.profilePicture || null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const fallbackAvatar = brandingSettings?.logoUrl || null;
  const initials = (child.name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const handlePhotoChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Only JPG, PNG, WebP or GIF images are allowed.');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      setError(`Photo must be under ${MAX_PHOTO_SIZE_MB}MB.`);
      return;
    }
    setError(null);
    try {
      const b64 = await fileToBase64(file);
      setPhotoPreview(b64);
      setPhotoBase64(b64);
    } catch {
      setError('Failed to read photo. Please try again.');
    }
  }, []);

  const handleSave = async () => {
    if (!firstName.trim()) { setError('First name is required.'); return; }
    if (!lastName.trim()) { setError('Last name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      };
      if (photoBase64) payload.photo = photoBase64;
      const res = await learnerAPI.parentUpdate(child.id, payload);
      if (!res?.success) throw new Error(res?.message || 'Update failed');
      setSuccess(true);
      setTimeout(() => {
        const savedPhoto = res?.data?.photoUrl || photoPreview;
        onSaved?.({
          ...child,
          name: `${firstName.trim()} ${lastName.trim()}`,
          photo: savedPhoto,
          photoUrl: savedPhoto,
          profilePicture: savedPhoto,
        });
        onClose();
      }, 900);
    } catch (err) {
      setError(err?.message || 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Edit Student Profile</h2>
            <p className="text-xs text-gray-400 mt-0.5">Update name and photo for {child.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Photo upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Student"
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg ring-2 ring-gray-100"
                  onError={e => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                style={{ display: photoPreview ? 'none' : 'flex' }}
                className="w-24 h-24 rounded-full bg-[#4F46E5] border-4 border-white shadow-lg ring-2 ring-gray-100 items-center justify-center text-2xl font-bold text-white"
              >
                {fallbackAvatar
                  ? <img src={fallbackAvatar} alt="logo" className="w-full h-full rounded-full object-cover" />
                  : initials
                }
              </div>
              {/* Overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <Camera size={20} className="text-white" />
              </button>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#4F46E5] hover:underline"
            >
              <Upload size={12} /> Change Photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <p className="text-[10px] text-gray-400">JPG, PNG or WebP · Max {MAX_PHOTO_SIZE_MB}MB</p>
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First name"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30 focus:border-[#4F46E5] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last name"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30 focus:border-[#4F46E5] transition-colors"
              />
            </div>
          </div>

          {/* Read-only info */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
            {[
              { label: 'Grade', value: child.grade },
              { label: 'Class', value: child.className || child.stream || '—' },
              { label: 'Admission No.', value: child.admissionNumber || '—' },
            ].map(item => (
              <div key={item.label} className="flex justify-between">
                <span className="text-xs text-gray-400">{item.label}</span>
                <span className="text-xs font-semibold text-gray-700">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Error / Success */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertTriangle size={14} className="text-rose-500 flex-shrink-0" />
              <p className="text-xs text-rose-700">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
              <p className="text-xs text-emerald-700">Profile updated successfully!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || success}
            className="flex items-center gap-2 px-5 py-2 bg-[#4F46E5] text-white text-sm font-semibold rounded-xl hover:bg-[#4338ca] disabled:opacity-50 transition-colors"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
