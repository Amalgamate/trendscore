import React from 'react';
import { Briefcase, MapPin, MessageCircle, SlidersHorizontal } from 'lucide-react';

function Empty({ children }) {
  return <p className="text-[11px] italic text-gray-400">{children}</p>;
}

export default function CounsellorEvidencePanel({ evidence }) {
  const careers = evidence?.savedCareers || [];
  const schools = evidence?.schoolPreferences || [];
  const comments = evidence?.parentComments || [];
  const family = evidence?.familyPreferences;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4" aria-label="Consolidated learner evidence">
      <div className="mb-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-violet-600">Decision Evidence</p>
        <p className="text-[11px] text-gray-500">Career interests, family constraints, school shortlist and parent input together.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-500"><Briefcase size={11} /> Saved careers</p>
          {careers.length ? <div className="flex flex-wrap gap-1.5">{careers.map(item => <span key={item.id} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">{item.career?.title}{item.supportStatus ? ` · ${item.supportStatus.toLowerCase()}` : ''}</span>)}</div> : <Empty>No careers saved.</Empty>}
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-500"><MapPin size={11} /> School shortlist</p>
          {schools.length ? <div className="space-y-1.5">{schools.map(item => <div key={item.id} className="flex items-center justify-between gap-2 text-[11px]"><span className="font-bold text-gray-800">{item.rank}. {item.school?.name}</span><span className="text-gray-500">{item.school?.county}</span></div>)}</div> : <Empty>No schools shortlisted.</Empty>}
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-500"><SlidersHorizontal size={11} /> Family preferences</p>
          {family ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <dt className="text-gray-500">Budget</dt><dd className="font-bold text-gray-800">{family.budgetBand || 'Not set'}</dd>
              <dt className="text-gray-500">Boarding</dt><dd className="font-bold text-gray-800">{family.boardingPreference || 'Not set'}</dd>
              <dt className="text-gray-500">Counties</dt><dd className="font-bold text-gray-800">{family.preferredCounties?.join(', ') || 'Not set'}</dd>
              <dt className="text-gray-500">Faith</dt><dd className="font-bold text-gray-800">{family.faithPreference || 'Not set'}</dd>
              {family.notes && <><dt className="text-gray-500">Notes</dt><dd className="font-bold text-gray-800">{family.notes}</dd></>}
            </dl>
          ) : <Empty>No family preferences recorded.</Empty>}
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-500"><MessageCircle size={11} /> Parent input</p>
          {comments.length ? <div className="space-y-2">{comments.slice(0, 4).map(item => <div key={item.id}><p className="text-[11px] text-gray-700">“{item.body}”</p><p className="text-[9px] text-gray-400">{item.author?.firstName} {item.author?.lastName} · {item.visibility === 'COUNSELLOR_ONLY' ? 'Private' : 'Shared'}</p></div>)}</div> : <Empty>No parent comments recorded.</Empty>}
        </div>
      </div>
    </section>
  );
}
