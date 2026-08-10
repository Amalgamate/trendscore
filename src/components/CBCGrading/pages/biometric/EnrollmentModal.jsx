import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ScanFace,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import AwsFaceLivenessCapture from '../../../biometric/AwsFaceLivenessCapture';
import { biometricAPI } from '../../../../services/api/biometric.api';

const EnrollmentModal = ({ person, type, onClose }) => {
  const [status, setStatus] = useState('CHECKING');
  const [enrollmentData, setEnrollmentData] = useState(null);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    try {
      setStatus('CHECKING');
      setError('');
      const data = await biometricAPI.getEnrollmentStatus(type.toLowerCase(), person.id);
      setEnrollmentData(data);
      setStatus('READY');
    } catch (err) {
      setError(err.message || 'Failed to load biometric enrollment status.');
      setStatus('ERROR');
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [person.id, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const faceCredential = enrollmentData?.credentials?.find(
    (credential) => credential.type === 'FACE' && credential.status === 'ACTIVE',
  );

  const startEnrollment = async () => {
    try {
      setStatus('STARTING');
      setError('');
      const nextSession = await biometricAPI.createFaceEnrollmentSession(type, person.id, consentConfirmed);
      setSession(nextSession);
      setStatus('CAPTURING');
    } catch (err) {
      setError(err.message || 'Unable to start face enrollment.');
      setStatus('ERROR');
    }
  };

  const completeEnrollment = async () => {
    try {
      setStatus('COMPLETING');
      await biometricAPI.completeFaceEnrollmentSession(session.sessionId);
      setSession(null);
      setStatus('SUCCESS');
    } catch (err) {
      setSession(null);
      setError(err.message || 'Face enrollment was not accepted.');
      setStatus('ERROR');
    }
  };

  const handleLivenessError = (livenessError) => {
    setSession(null);
    setError(livenessError?.error?.message || 'The liveness check could not be completed. Start a new capture.');
    setStatus('ERROR');
  };

  const revokeFace = async () => {
    if (!faceCredential || !window.confirm('Revoke this face enrollment? The learner or staff member must enroll again before face attendance works.')) return;
    try {
      setStatus('STARTING');
      await biometricAPI.revokeCredential(faceCredential.id);
      setConsentConfirmed(false);
      await fetchStatus();
    } catch (err) {
      setError(err.message || 'Unable to revoke face enrollment.');
      setStatus('ERROR');
    }
  };

  const personReference = person.admissionNumber || person.staffId || person.employeeCode || person.id.split('-')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className={`max-h-[96vh] w-full overflow-y-auto rounded-[2rem] border border-slate-200 bg-white shadow-2xl ${status === 'CAPTURING' ? 'max-w-4xl' : 'max-w-xl'}`}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-7 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-50 p-2.5 text-indigo-600"><ScanFace size={24} /></div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">AWS face enrollment</h2>
              <p className="mt-0.5 text-xs text-slate-500">Liveness verified · encrypted provider reference</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </header>

        <div className="p-7">
          <div className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-lg font-semibold text-indigo-600 shadow-sm">
              {person.firstName?.[0]}{person.lastName?.[0]}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{person.firstName} {person.lastName}</p>
              <p className="mt-1 text-xs text-slate-500">{type} · {personReference}</p>
            </div>
            <span className={`ml-auto rounded-full px-3 py-1 text-[10px] font-semibold ${faceCredential ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {faceCredential ? 'FACE ENROLLED' : 'NOT ENROLLED'}
            </span>
          </div>

          {status === 'CHECKING' && <LoadingState label="Checking enrollment…" />}
          {status === 'STARTING' && <LoadingState label="Creating a secure AWS session…" />}
          {status === 'COMPLETING' && <LoadingState label="Verifying liveness and indexing face…" />}

          {status === 'CAPTURING' && session && (
            <AwsFaceLivenessCapture
              session={session}
              onAnalysisComplete={completeEnrollment}
              onError={handleLivenessError}
              onCancel={() => {
                setSession(null);
                setStatus('READY');
              }}
            />
          )}

          {status === 'READY' && (
            <div className="space-y-5">
              {faceCredential ? (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
                  <div className="flex items-center gap-3 text-emerald-700"><CheckCircle2 size={24} /><h3 className="font-semibold">Face recognition is active</h3></div>
                  <p className="mt-3 text-sm leading-6 text-emerald-800/80">
                    Enrolled {new Date(faceCredential.enrolledAt).toLocaleString()} using {faceCredential.provider || 'the configured provider'}.
                  </p>
                  <button onClick={revokeFace} className="mt-5 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-rose-700 shadow-sm">
                    <Trash2 size={15} /> Revoke face enrollment
                  </button>
                </div>
              ) : (
                <>
                  <div className="rounded-3xl bg-slate-950 p-6 text-white">
                    <div className="flex items-center gap-3"><ShieldCheck className="text-indigo-300" /><h3 className="font-semibold">Before capturing</h3></div>
                    <ul className="mt-4 space-y-2 text-xs leading-5 text-white/70">
                      <li>Use the learner or staff member who is being enrolled.</li>
                      <li>Stand in even lighting and remove face coverings where appropriate.</li>
                      <li>TrendSCORE stores an encrypted AWS face reference, not the camera video.</li>
                    </ul>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                    <input
                      type="checkbox"
                      checked={consentConfirmed}
                      onChange={(event) => setConsentConfirmed(event.target.checked)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span className="text-xs leading-5 text-slate-700">
                      I confirm that documented parent/guardian consent (or staff consent) and the school’s approved biometric purpose are on record.
                    </span>
                  </label>

                  <button
                    onClick={startEnrollment}
                    disabled={!consentConfirmed}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ScanFace size={18} /> Start live face enrollment
                  </button>
                </>
              )}
            </div>
          )}

          {status === 'SUCCESS' && (
            <div className="py-10 text-center">
              <CheckCircle2 size={56} className="mx-auto text-emerald-500" />
              <h3 className="mt-5 text-xl font-semibold text-slate-900">Face enrolled</h3>
              <p className="mt-2 text-sm text-slate-500">This person can now use a configured phone face terminal.</p>
              <button onClick={onClose} className="mt-6 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white">Done</button>
            </div>
          )}

          {status === 'ERROR' && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
              <AlertCircle size={40} className="mx-auto text-rose-600" />
              <h3 className="mt-4 font-semibold text-slate-900">Face enrollment did not complete</h3>
              <p className="mt-2 text-sm leading-6 text-rose-700">{error}</p>
              <button onClick={fetchStatus} className="mt-5 rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm">Return to enrollment</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LoadingState = ({ label }) => (
  <div className="flex flex-col items-center py-14 text-center">
    <Loader2 size={38} className="animate-spin text-indigo-600" />
    <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
  </div>
);

export default EnrollmentModal;
