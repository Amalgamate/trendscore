import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, Upload, Check, RefreshCw, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

const ProfilePhotoModal = ({ isOpen, onClose, onSave, currentPhoto }) => {
    const [mode, setMode] = useState('select'); // 'select', 'camera', 'upload', 'preview'
    const [previewUrl, setPreviewUrl] = useState(null);
    const [stream, setStream] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const streamRef = useRef(null); // holds the live MediaStream so stopCamera never changes identity

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setStream(null);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setMode('select');
            setPreviewUrl(currentPhoto || null);
        }
        return () => {
            stopCamera();
        };
    }, [isOpen, currentPhoto, stopCamera]);

    useEffect(() => {
        if (mode === 'camera' && stream && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [mode, stream]);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' }
            });
            streamRef.current = mediaStream;
            setStream(mediaStream);
            setMode('camera');
        } catch (err) {
            console.error("Error accessing camera:", err);
            toast.error("Could not access camera. Please check permissions.");
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setPreviewUrl(dataUrl);
            setMode('preview');
            stopCamera();
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error("File size must be less than 5MB");
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result);
                setMode('preview');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (previewUrl) {
            const ok = await onSave(previewUrl);
            if (ok !== false) onClose();
        }
    };

    const reset = () => {
        setPreviewUrl(currentPhoto);
        setMode('select');
        stopCamera();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <h3 className="font-medium text-gray-800">Update Profile Photo</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {mode === 'select' && (
                        <div className="space-y-4">
                            <div className="flex justify-center mb-6">
                                <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg">
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="Current profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <ImageIcon size={48} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={startCamera}
                                    className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-brand-purple hover:bg-brand-purple/5 transition group"
                                >
                                    <div className="p-3 rounded-full bg-brand-purple/10 text-brand-purple group-hover:bg-brand-purple group-hover:text-white transition">
                                        <Camera size={24} />
                                    </div>
                                    <span className="font-semibold text-gray-700">Take Photo</span>
                                </button>

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-brand-teal hover:bg-brand-teal/5 transition group"
                                >
                                    <div className="p-3 rounded-full bg-brand-teal/10 text-brand-teal group-hover:bg-brand-teal group-hover:text-white transition">
                                        <Upload size={24} />
                                    </div>
                                    <span className="font-semibold text-gray-700">Upload File</span>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                    />
                                </button>
                            </div>
                        </div>
                    )}

                    {mode === 'camera' && (
                        <div className="flex flex-col items-center space-y-4">
                            <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-inner">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
                                />
                            </div>
                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={reset}
                                    className="flex-1 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={capturePhoto}
                                    className="flex-1 py-2 flex items-center justify-center gap-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-purple/90 transition shadow-lg shadow-brand-purple/20"
                                >
                                    <Camera size={18} />
                                    Capture
                                </button>
                            </div>
                            <canvas ref={canvasRef} className="hidden" />
                        </div>
                    )}

                    {mode === 'preview' && (
                        <div className="flex flex-col items-center space-y-6">
                            <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-brand-purple shadow-xl">
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                            </div>

                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={reset}
                                    className="flex-1 py-2 flex items-center justify-center gap-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
                                >
                                    <RefreshCw size={18} />
                                    Retake
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 py-2 flex items-center justify-center gap-2 bg-brand-teal text-white rounded-lg font-medium hover:bg-brand-teal/90 transition shadow-lg shadow-brand-teal/20"
                                >
                                    <Check size={18} />
                                    Save Photo
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfilePhotoModal;
