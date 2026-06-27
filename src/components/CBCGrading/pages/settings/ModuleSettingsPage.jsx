import React, { useEffect, useMemo, useState } from 'react';
import { Check, Lock, Package, RefreshCw, Save, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { schoolAPI } from '../../../../services/api';
import { useModuleAccess } from '../../../../contexts/ModuleAccessContext';

const categoryOrder = ['Core', 'Academics', 'Finance', 'Communication', 'Operations', 'HR', 'Administration'];

const groupByCategory = (modules) => (
  modules.reduce((acc, module) => {
    const key = module.category || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(module);
    return acc;
  }, {})
);

const ModuleSettingsPage = () => {
  const { refreshModules } = useModuleAccess();
  const [modules, setModules] = useState([]);
  const [packages, setPackages] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await schoolAPI.getModules();
      const data = response?.data || response;
      setModules(data?.modules || []);
      setPackages(data?.packages || {});
    } catch (error) {
      toast.error(error.message || 'Failed to load module settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeCount = modules.filter((module) => module.isActive && module.isVisible).length;
  const premiumOffCount = modules.filter((module) => !module.isActive && !module.isMandatory).length;

  const grouped = useMemo(() => groupByCategory(modules), [modules]);
  const categories = useMemo(() => {
    const keys = Object.keys(grouped);
    return keys.sort((a, b) => {
      const ai = categoryOrder.indexOf(a);
      const bi = categoryOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [grouped]);

  const setModuleActive = (slug, isActive) => {
    setModules((current) => current.map((module) => (
      module.slug === slug ? { ...module, isActive } : module
    )));
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await schoolAPI.updateModules({
        modules: modules.map((module) => ({
          slug: module.slug,
          isActive: module.isActive,
          isVisible: module.isVisible,
        })),
      });
      const data = response?.data || response;
      setModules(data?.modules || modules);
      await refreshModules();
      toast.success('Module configuration saved');
    } catch (error) {
      toast.error(error.message || 'Failed to save module settings');
    } finally {
      setSaving(false);
    }
  };

  const applyPackage = async (packageId) => {
    if (!window.confirm(`Apply the ${packages[packageId]?.name || packageId} module package? This will reset module toggles to that package.`)) return;
    setSaving(true);
    try {
      const response = await schoolAPI.applyModulePackage(packageId);
      const data = response?.data || response;
      setModules(data?.modules || []);
      setPackages(data?.packages || packages);
      await refreshModules();
      toast.success(`${packages[packageId]?.name || packageId} package applied`);
    } catch (error) {
      toast.error(error.message || 'Failed to apply package');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <Package size={14} />
              Modules & Package
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Module Access</h1>
            <p className="mt-1 text-sm text-slate-500">Control which modules are visible and usable for this school.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              onClick={save}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Active Modules</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{activeCount}</p>
          </div>
          <div className="border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Premium Disabled</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{premiumOffCount}</p>
          </div>
          <div className="border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Base Package</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">Starter ready</p>
          </div>
        </div>

        <section className="border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">Apply Package Preset</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Object.values(packages).map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => applyPackage(pkg.id)}
                disabled={saving}
                className="text-left rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-60"
              >
                <p className="font-semibold text-slate-950">{pkg.name}</p>
                <p className="mt-1 min-h-10 text-xs leading-relaxed text-slate-500">{pkg.description}</p>
                <p className="mt-3 text-xs font-semibold text-blue-700">{pkg.active?.length || 0} modules included</p>
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">Loading module configuration...</div>
        ) : (
          <div className="space-y-4">
            {categories.map((category) => (
              <section key={category} className="border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">{category}</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {grouped[category].map((module) => (
                    <div key={module.slug} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-950">{module.name}</p>
                          {module.isMandatory && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                              <Lock size={11} />
                              Locked
                            </span>
                          )}
                          {module.isActive && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              <Check size={11} />
                              Active
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{module.description}</p>
                        <p className="mt-1 text-xs text-slate-400">{module.slug}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModuleActive(module.slug, !module.isActive)}
                        disabled={module.isMandatory || saving}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition md:w-32 ${
                          module.isActive
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {module.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        {module.isActive ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuleSettingsPage;
