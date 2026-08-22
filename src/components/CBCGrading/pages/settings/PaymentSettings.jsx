import React, { useCallback, useState, useEffect } from 'react';
import { DollarSign, Save, Loader, CreditCard, Shield, Globe, Terminal } from 'lucide-react';
import { communicationAPI } from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import { PRODUCT_DISPLAY_NAME } from '../../../../config/productIdentity';
import MpesaOnboardingChecklist from '../../../payments/MpesaOnboardingChecklist';

const PaymentSettings = () => {
    const [loading, setLoading] = useState(false);
    const [onboardingReady, setOnboardingReady] = useState(false);
    const [onboardingChecklist, setOnboardingChecklist] = useState({});
    const { showSuccess, showError } = useNotifications();

    const [mpesaSettings, setMpesaSettings] = useState({
        enabled: false,
        provider: 'daraja',
        publicKey: '', // Consumer Key (Daraja) / Client ID (Kopo Kopo)
        secretKey: '', // Consumer Secret (Daraja) / Client Secret (Kopo Kopo)
        apiKey: '',    // API Key (Kopo Kopo specific)
        shortcode: '', // Shortcode (Daraja) / Till Number (Kopo Kopo)
        passkey: '',   // Passkey (Daraja specific)
        sandbox: false,
        hasPublicKey: false,
        hasSecretKey: false,
        hasApiKey: false,
        hasPasskey: false
    });

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const response = await communicationAPI.getConfig();
            const config = (response.data || response).mpesa || {};

            setMpesaSettings({
                enabled: config.enabled || false,
                provider: config.provider || 'daraja',
                publicKey: config.publicKey || '',
                secretKey: '',
                apiKey: '',
                passkey: '',
                shortcode: config.businessNumber || '',
                sandbox: config.sandbox || false,
                hasPublicKey: !!config.publicKey,
                hasSecretKey: !!config.hasSecretKey,
                hasApiKey: !!config.hasApiKey,
                hasPasskey: !!config.hasPasskey
            });
            setOnboardingChecklist(config.onboardingChecklist || {});
        } catch (error) {
            console.error('Failed to load payment config:', error);
            showError('Failed to load payment configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (mpesaSettings.enabled && !onboardingReady) {
            showError('Complete all M-PESA activation prerequisites before enabling collections.');
            return;
        }
        try {
            setLoading(true);

            const payload = {
                mpesa: {
                    enabled: mpesaSettings.enabled,
                    provider: mpesaSettings.provider,
                    publicKey: mpesaSettings.publicKey,
                    businessNumber: mpesaSettings.shortcode,
                    secretKey: mpesaSettings.secretKey || undefined,
                    apiKey: mpesaSettings.apiKey || undefined,
                    passkey: mpesaSettings.passkey || undefined,
                    sandbox: mpesaSettings.sandbox,
                    onboardingChecklist: {
                        ...onboardingChecklist,
                        ...credentialReadiness
                    }
                }
            };

            await communicationAPI.saveConfig(payload);
            showSuccess('Payment settings saved successfully!');

            // Reload to update "has" flags
            await loadConfig();
        } catch (error) {
            console.error('Save error:', error);
            showError(error.message || 'Failed to save payment settings');
        } finally {
            setLoading(false);
        }
    };

    const isKopoKopo = mpesaSettings.provider === 'kopokopo';
    const handleReadinessChange = useCallback(({ ready }) => setOnboardingReady(ready), []);
    const credentialReadiness = {
        provider_account: Boolean(mpesaSettings.provider),
        credentials: Boolean(
            mpesaSettings.shortcode &&
            (mpesaSettings.publicKey || mpesaSettings.hasPublicKey) &&
            (mpesaSettings.secretKey || mpesaSettings.hasSecretKey) &&
            (isKopoKopo
                ? (mpesaSettings.apiKey || mpesaSettings.hasApiKey)
                : (mpesaSettings.passkey || mpesaSettings.hasPasskey))
        )
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-8 text-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                            <DollarSign size={32} />
                        </div>
                        <div>
                            <h2 className="text-3xl font-semibold tracking-tight">Payment Gateway</h2>
                            <p className="text-green-50 opacity-90">Manage M-Pesa collections and bulk payouts</p>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    <div className="mb-8">
                        <MpesaOnboardingChecklist
                            interactive
                            credentialReadiness={credentialReadiness}
                            onReadinessChange={handleReadinessChange}
                            value={onboardingChecklist}
                            onChange={setOnboardingChecklist}
                        />
                    </div>
                    {/* Provider Selection */}
                    <div className="mb-10">
                        <label className="block text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                            <Globe size={18} className="text-green-600"/> Select M-Pesa Provider
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => setMpesaSettings({...mpesaSettings, provider: 'daraja'})}
                                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                    mpesaSettings.provider === 'daraja' 
                                    ? 'border-green-600 bg-green-50 text-green-900' 
                                    : 'border-gray-200 hover:border-gray-300 bg-white text-gray-600'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${mpesaSettings.provider === 'daraja' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}>
                                        <Shield size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-medium">Safaricom Daraja</p>
                                        <p className="text-xs opacity-70">Direct integration via Safaricom</p>
                                    </div>
                                </div>
                                {mpesaSettings.provider === 'daraja' && <div className="w-4 h-4 bg-green-600 rounded-full border-2 border-white shadow-sm"/>}
                            </button>

                            <button
                                onClick={() => setMpesaSettings({...mpesaSettings, provider: 'kopokopo'})}
                                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                    mpesaSettings.provider === 'kopokopo' 
                                    ? 'border-green-600 bg-green-50 text-green-900' 
                                    : 'border-gray-200 hover:border-gray-300 bg-white text-gray-600'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${mpesaSettings.provider === 'kopokopo' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}>
                                        <Terminal size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-medium">Kopo Kopo</p>
                                        <p className="text-xs opacity-70">Unified collection & bulk payouts</p>
                                    </div>
                                </div>
                                {mpesaSettings.provider === 'kopokopo' && <div className="w-4 h-4 bg-green-600 rounded-full border-2 border-white shadow-sm"/>}
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <Loader className="animate-spin mb-4" size={40} />
                            <p className="animate-pulse">Loading secure configuration...</p>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className={`p-6 rounded-2xl border transition-all ${mpesaSettings.sandbox ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
                                <div className="flex items-start gap-4">
                                    <div className={`p-2 rounded-lg ${mpesaSettings.sandbox ? 'bg-orange-600' : 'bg-blue-600'} text-white`}>
                                        <CreditCard size={24} />
                                    </div>
                                    <div>
                                        <h3 className={`text-lg font-medium ${mpesaSettings.sandbox ? 'text-orange-900' : 'text-blue-900'}`}>
                                            {isKopoKopo ? 'Kopo Kopo Integration' : 'Daraja API Configuration'}
                                            {mpesaSettings.sandbox && <span className="ml-3 px-2 py-0.5 bg-orange-200 text-orange-800 text-xs rounded-full uppercase tracking-wider">Sandbox Mode</span>}
                                        </h3>
                                        <p className={`text-sm ${mpesaSettings.sandbox ? 'text-orange-700' : 'text-blue-700'} opacity-80`}>
                                            {isKopoKopo 
                                                ? 'Utilize Kopo Kopo for automated fee collection and bulk payroll disbursements.' 
                                                : 'Directly connect to Safaricom Daraja for Lipa Na M-Pesa Online collections.'
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Shortcode / Till Number */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {isKopoKopo ? 'Till Number / Shortcode' : 'Business Shortcode'}
                                    </label>
                                    <input
                                        type="text"
                                        value={mpesaSettings.shortcode}
                                        onChange={(e) => setMpesaSettings({ ...mpesaSettings, shortcode: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white transition-all outline-none"
                                        placeholder={isKopoKopo ? 'e.g. 123456' : 'e.g. 174379'}
                                    />
                                    <p className="text-xs text-gray-500 mt-2 font-medium">Your primary target identifier for payments</p>
                                </div>

                                {/* Sandbox Toggle */}
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 h-[72px] mt-auto">
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm">Sandbox Mode</p>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">Recommended for testing</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={mpesaSettings.sandbox}
                                            onChange={(e) => setMpesaSettings({ ...mpesaSettings, sandbox: e.target.checked })}
                                        />
                                        <div className="w-12 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-6 border-t pt-6">
                                {/* Public Key / Consumer Key */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {isKopoKopo ? 'Application ID' : 'Consumer Key'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={mpesaSettings.publicKey}
                                            onChange={(e) => setMpesaSettings({ ...mpesaSettings, publicKey: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white transition-all outline-none"
                                            placeholder={mpesaSettings.hasPublicKey ? '****************' : `Enter ${isKopoKopo ? 'Application ID' : 'Consumer Key'}...`}
                                        />
                                        {mpesaSettings.hasPublicKey && !mpesaSettings.publicKey && (
                                            <span className="absolute right-3 top-3 text-[10px] text-emerald-700 font-medium bg-emerald-100 px-2 py-1 rounded-lg uppercase tracking-wider">Saved</span>
                                        )}
                                    </div>
                                </div>

                                {/* Secret Key / Consumer Secret */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {isKopoKopo ? 'Application Secret' : 'Consumer Secret'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={mpesaSettings.secretKey}
                                            onChange={(e) => setMpesaSettings({ ...mpesaSettings, secretKey: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white transition-all outline-none"
                                            placeholder={mpesaSettings.hasSecretKey ? '****************' : `Enter ${isKopoKopo ? 'Application Secret' : 'Consumer Secret'}...`}
                                        />
                                        {mpesaSettings.hasSecretKey && !mpesaSettings.secretKey && (
                                            <span className="absolute right-3 top-3 text-[10px] text-emerald-700 font-medium bg-emerald-100 px-2 py-1 rounded-lg uppercase tracking-wider">Saved</span>
                                        )}
                                    </div>
                                </div>

                                {isKopoKopo ? (
                                    /* Kopo Kopo API Key */
                                    <div className="animate-in slide-in-from-top-2 duration-300">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                                        <div className="relative">
                                            <input
                                                type="password"
                                                value={mpesaSettings.apiKey}
                                                onChange={(e) => setMpesaSettings({ ...mpesaSettings, apiKey: e.target.value })}
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white transition-all outline-none"
                                                placeholder={mpesaSettings.hasApiKey ? '****************' : 'Enter Kopo Kopo API Key...'}
                                            />
                                            {mpesaSettings.hasApiKey && !mpesaSettings.apiKey && (
                                                <span className="absolute right-3 top-3 text-[10px] text-emerald-700 font-medium bg-emerald-100 px-2 py-1 rounded-lg uppercase tracking-wider">Saved</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">Required for validating webhooks and status inquiries</p>
                                    </div>
                                ) : (
                                    /* Daraja Passkey */
                                    <div className="animate-in slide-in-from-top-2 duration-300">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Daraja Passkey</label>
                                        <div className="relative">
                                            <input
                                                type="password"
                                                value={mpesaSettings.passkey}
                                                onChange={(e) => setMpesaSettings({ ...mpesaSettings, passkey: e.target.value })}
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white transition-all outline-none"
                                                placeholder={mpesaSettings.hasPasskey ? '****************' : 'Enter Lipa Na M-Pesa Passkey...'}
                                            />
                                            {mpesaSettings.hasPasskey && !mpesaSettings.passkey && (
                                                <span className="absolute right-3 top-3 text-[10px] text-emerald-700 font-medium bg-emerald-100 px-2 py-1 rounded-lg uppercase tracking-wider">Saved</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={mpesaSettings.enabled}
                                                onChange={(e) => {
                                                    if (e.target.checked && !onboardingReady) {
                                                        showError('Complete the M-PESA activation checklist first.');
                                                        return;
                                                    }
                                                    setMpesaSettings({ ...mpesaSettings, enabled: e.target.checked });
                                                }}
                                            />
                                            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
                                        </label>
                                        <span className="text-sm font-semibold text-gray-700 uppercase tracking-widest">Gateway Active</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSave}
                                    disabled={loading}
                                    className="w-full md:w-auto flex items-center justify-center gap-3 px-10 py-4 bg-green-600 text-white rounded-2xl hover:bg-green-700 active:scale-95 transition-all font-medium shadow-lg shadow-green-200 disabled:opacity-50 disabled:active:scale-100"
                                >
                                    {loading ? <Loader size={22} className="animate-spin" /> : <Save size={22} />}
                                    {loading ? 'Saving Changes...' : 'Synchronize Settings'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Info Footer */}
                <div className="bg-gray-50 border-t p-6 text-center">
                    <p className="text-xs text-gray-500 font-medium max-w-2xl mx-auto">
                        {PRODUCT_DISPLAY_NAME} uses industry-standard 256-bit encryption to protect your sensitive API credentials.
                        Ensure your callback URL is correctly configured in your provider's portal to receive real-time payment updates.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PaymentSettings;
