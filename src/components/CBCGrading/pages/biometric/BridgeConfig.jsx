import React from 'react';
import { 
  Terminal, 
  Download, 
  ExternalLink, 
  BookOpen, 
  ShieldCheck, 
  Key, 
  Globe,
  Settings,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

const BridgeConfig = () => {
  const apiUrl = window.location.origin + '/api/biometric';
  
  const steps = [
    {
      title: 'Environment Preparation',
      desc: 'Ensure the host machine is running Windows 10/11 with USB 2.0+ support.',
      icon: Terminal
    },
    {
      title: 'Install Bridge Service',
      desc: 'Download and run the TrendScore Biometric Bridge installer on the workstation.',
      icon: Download
    },
    {
      title: 'Initialize Hardware',
      desc: 'Connect your ZKTECO or compatible USB scanner. The bridge will auto-detect the SDK.',
      icon: Settings
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      {/* Introduction */}
      <div className="text-center space-y-4">
        <div className="inline-flex p-3 bg-indigo-50 text-indigo-600 rounded-2xl mb-2">
          <Globe size={32} />
        </div>
        <h2 className="text-3xl font-semibold text-slate-900 uppercase tracking-tight">Interface Architecture</h2>
        <p className="text-sm text-slate-500 font-medium max-w-xl mx-auto">
          The TrendScore Biometric System uses a secure bridge architecture to connect local hardware (USB Fingerprint Scanners) to our cloud infrastructure.
        </p>
      </div>

      {/* API Configuration Card */}
      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="p-8 md:p-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-slate-900 text-white rounded-xl">
              <Key size={20} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 uppercase tracking-tight">Cloud Endpoint Configuration</h3>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1 text-left block">Host API Management URL</label>
              <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl group focus-within:border-indigo-500 transition-all">
                <code className="flex-1 text-xs font-medium text-slate-700 font-mono select-all">
                  {apiUrl}
                </code>
                <button 
                  onClick={() => navigator.clipboard.writeText(apiUrl)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-semibold uppercase tracking-widest text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 flex items-start gap-4">
              <AlertCircle className="text-amber-600 mt-1 shrink-0" size={20} />
              <div>
                <h4 className="text-xs font-semibold text-amber-900 uppercase tracking-tight mb-1">Security Warning</h4>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Never share your Device Tokens or the Host API URL with unauthorized personnel. Each terminal must be registered individually to maintain an audit trail.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 hover:border-indigo-300 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <step.icon size={24} />
            </div>
            <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-[0.2em] mb-2">Step 0{i+1}</p>
            <h4 className="text-sm font-semibold text-slate-900 mb-3">{step.title}</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>

      {/* Help Section */}
      <div className="bg-slate-900 rounded-[3rem] p-8 md:p-12 text-white relative overflow-hidden">
        <HelpCircle className="absolute -right-8 -bottom-8 text-white/5" size={200} />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 text-center md:text-left">
            <h3 className="text-2xl font-semibold uppercase tracking-tight">Need technical assistance?</h3>
            <p className="text-indigo-200 text-sm max-w-md font-medium">
              Our engineering team can help with SDK integration for ZKTeco, DigitalPersona, or custom HID devices.
            </p>
          </div>
          <button className="px-8 py-4 bg-indigo-600 rounded-2xl text-xs font-semibold uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/40 flex items-center gap-2">
            <BookOpen size={18} />
            View Documentation
          </button>
        </div>
      </div>
    </div>
  );
};

export default BridgeConfig;
