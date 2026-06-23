import React, { useEffect, useMemo, useState } from 'react';
import {
    User, Mail, Phone, Users, MapPin,
    Briefcase, FileText, Download, GraduationCap, Key
} from 'lucide-react';
import api from '../../../../services/api';
import ProfileHeader from '../../shared/ProfileHeader';
import ProfileLayout from '../../shared/ProfileLayout';
import { useNotifications } from '../../hooks/useNotifications';
import ProfilePhotoModal from '../../shared/ProfilePhotoModal';

const normalizeParentProfile = (parent = {}) => {
    const derivedName = [parent.firstName, parent.middleName, parent.lastName].filter(Boolean).join(' ').trim();
    const fullName = derivedName || parent.name;
    const learners = Array.isArray(parent.learners) ? parent.learners : [];

    return {
        ...parent,
        name: fullName || parent.email || parent.phone || 'Parent/Guardian',
        relationship: parent.relationship || 'Parent/Guardian',
        occupation: parent.occupation || 'N/A',
        county: parent.county || 'N/A',
        learners,
        learnerIds: Array.isArray(parent.learnerIds)
            ? parent.learnerIds
            : learners.map((learner) => learner.admissionNumber).filter(Boolean)
    };
};

const ParentProfile = ({ parent, onBack }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const { showSuccess, showError } = useNotifications();
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [resolvedParent, setResolvedParent] = useState(() => normalizeParentProfile(parent));

    useEffect(() => {
        let isMounted = true;
        const initialParent = normalizeParentProfile(parent);
        setResolvedParent(initialParent);

        if (!parent?.id) return () => { isMounted = false; };

        const fetchLatestParent = async () => {
            try {
                const response = await api.users.getById(parent.id);
                if (!isMounted || !response?.success) return;
                setResolvedParent(normalizeParentProfile({
                    ...initialParent,
                    ...response.data
                }));
            } catch (error) {
                console.error('Failed to refresh parent profile:', error);
            }
        };

        fetchLatestParent();
        return () => { isMounted = false; };
    }, [parent]);

    const displayParent = useMemo(() => normalizeParentProfile(resolvedParent), [resolvedParent]);
    const displayName = displayParent.name;

    const handleSavePhoto = async (photoData) => {
        try {
            const response = await api.users.uploadPhoto(displayParent.id, photoData);
            if (response?.success) {
                setResolvedParent((prev) => normalizeParentProfile({
                    ...prev,
                    profilePicture: photoData
                }));
                showSuccess('Profile photo updated successfully');
                return true;
            }
            showError(response?.error || 'Failed to update profile photo');
            return false;
        } catch (error) {
            console.error('Failed to upload photo:', error);
            showError('Failed to update profile photo');
            return false;
        }
    };

    const handleSendCredentials = async () => {
        if (!displayParent.phone && !displayParent.email) {
            showError('Parent needs a phone or email to receive credentials.');
            return;
        }

        if (!window.confirm(`Send login credentials to ${displayName}? This will reset their password and notify them.`)) {
            return;
        }

        try {
            const response = await api.users.sendCredentials(displayParent.id);
            if (response.success) {
                showSuccess('Credentials dispatched via SMS and WhatsApp!');
            } else {
                showError(response.message || 'Failed to send credentials');
            }
        } catch (error) {
            showError('Network error while sending credentials');
        }
    };

    const documents = [
        { id: 1, name: 'ID_Copy.jpg', date: '2020-03-15', size: '2.1 MB' },
        { id: 2, name: 'Communication_Consent.pdf', date: '2021-01-20', size: '150 KB' },
    ];

    if (!displayParent) return null;

    const tabs = [
        { id: 'overview', label: 'Overview', icon: User },
        { id: 'children', label: 'Linked Students', icon: Users },
        { id: 'documents', label: 'Documents', icon: FileText },
    ];

    return (
        <ProfileLayout
            title="Parent Profile"
            onBack={onBack}
            onPrint={() => window.print()}
            secondaryAction={{
                label: "Send Credentials",
                icon: Key,
                onClick: handleSendCredentials,
                className: "text-orange-600 border-orange-100 hover:bg-orange-50"
            }}
            primaryAction={{
                label: "Edit Profile",
                onClick: () => console.log('Edit Profile')
            }}
        >
            <ProfileHeader
                name={displayName}
                avatar={displayParent.profilePicture || displayParent.avatar}
                avatarFallback={displayName.substring(0, 2).toUpperCase()}
                bannerPattern="pattern-grid-lg"
                bannerColor="brand-purple"
                badges={[
                    { text: displayParent.relationship, className: "px-2.5 py-0.5 rounded-md bg-purple-50 text-brand-purple text-xs font-medium uppercase tracking-wider border border-purple-100" },
                    { text: displayParent.county || 'N/A', icon: MapPin }
                ]}
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onPhotoClick={() => setShowPhotoModal(true)}
            />

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                <div className="flex items-center gap-2 mb-6 pb-2 border-b border-gray-100">
                                    <User className="text-brand-purple" size={20} />
                                    <h3 className="text-lg font-medium text-gray-800">Contact & Personal Details</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                                    <div>
                                        <label className="premium-label flex items-center gap-2">
                                            <Phone size={14} className="text-gray-400" /> Phone Number
                                        </label>
                                        <p className="text-gray-800 font-medium text-lg">{displayParent.phone || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="premium-label flex items-center gap-2">
                                            <Mail size={14} className="text-gray-400" /> Email Address
                                        </label>
                                        <p className="text-gray-800 font-medium">{displayParent.email || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="premium-label flex items-center gap-2">
                                            <Briefcase size={14} className="text-gray-400" /> Occupation
                                        </label>
                                        <p className="text-gray-800 font-medium">{displayParent.occupation || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="premium-label flex items-center gap-2">
                                            <MapPin size={14} className="text-gray-400" /> ID Number
                                        </label>
                                        <p className="text-gray-800 font-medium">{displayParent.idNumber || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* CHILDREN TAB */}
                {activeTab === 'children' && (
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 animate-fade-in">
                        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-gray-100">
                            <Users className="text-brand-teal" size={20} />
                            <h3 className="text-lg font-medium text-gray-800">Linked Students</h3>
                        </div>

                        {(displayParent.learners && displayParent.learners.length > 0) || (displayParent.learnerIds && displayParent.learnerIds.length > 0) ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {displayParent.learners && displayParent.learners.length > 0 ? (
                                    displayParent.learners.map((learner, index) => (
                                        <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-4">
                                            <div className="p-3 bg-white rounded-full border border-gray-200 text-brand-purple">
                                                <GraduationCap size={24} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-800 text-lg">{learner.firstName} {learner.lastName}</p>
                                                <p className="text-sm text-gray-500">
                                                    {learner.admissionNumber}{learner.grade ? ` • ${learner.grade}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    displayParent.learnerIds.map((id, index) => (
                                        <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-4">
                                            <div className="p-3 bg-white rounded-full border border-gray-200 text-brand-purple">
                                                <GraduationCap size={24} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-800 text-lg">Student: {id}</p>
                                                <p className="text-sm text-gray-500">Linked Profile</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                                <Users size={48} className="mb-4 text-gray-200" />
                                <p className="text-gray-500 italic">No students linked yet.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* DOCUMENTS TAB */}
                {activeTab === 'documents' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-medium text-gray-800">Attached Documents</h3>
                            <button className="text-sm text-brand-purple font-medium hover:underline">
                                Upload New
                            </button>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {documents.map((doc) => (
                                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-800">{doc.name}</p>
                                            <p className="text-xs text-gray-500">{doc.size} • {doc.date}</p>
                                        </div>
                                    </div>
                                    <button className="p-2 text-gray-400 hover:text-brand-purple transition">
                                        <Download size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <ProfilePhotoModal
                isOpen={showPhotoModal}
                onClose={() => setShowPhotoModal(false)}
                onSave={handleSavePhoto}
                currentPhoto={displayParent.profilePicture || displayParent.avatar}
            />
        </ProfileLayout>
    );
};

export default ParentProfile;
