/**
 * KnowledgeBase
 * Full in-app documentation centre for all roles.
 * Page key: 'knowledge-base' (already mapped in PageRouter via SupportHub → 'help')
 */
import React, { useState, useMemo } from 'react';
import {
  BookOpen, Search, ChevronRight, ChevronDown,
  Users, GraduationCap, UserCheck, Shield,
  Activity, Home, BarChart3, Bus, Fingerprint,
  MessageSquare, CreditCard, HelpCircle, CheckCircle2,
  AlertTriangle, Info, Star, Lightbulb
} from 'lucide-react';
import { PRODUCT_DISPLAY_NAME } from '../../../config/productIdentity';

// ── Article database ──────────────────────────────────────────────────────────
const ARTICLES = [
  // ── GETTING STARTED ─────────────────────────────────────────────────────────
  {
    id: 'gs-1', category: 'Getting Started', audience: ['ADMIN','SUPER_ADMIN','HEAD_TEACHER'],
    title: 'First-time setup checklist',
    icon: CheckCircle2, iconColor: 'text-emerald-600',
    body: [
      { type: 'p', text: `Welcome to ${PRODUCT_DISPLAY_NAME}. Follow this checklist in order — each step unlocks the next.` },
      { type: 'steps', items: [
        'Go to Settings → School Settings and confirm the school name, logo, county and principal details.',
        'Go to Settings → Academic Settings. Create the current academic year (e.g. 2026), set Term 1 as active, and create all grades and streams.',
        'Go to Settings → User Management. Add teachers, give each the TEACHER role and assign them to a class.',
        'Go to System Maintenance → Import Learners. Download the template, fill it in and upload. Review validation errors before confirming.',
        'Go to Settings → Communication Settings. Enter your SMS provider credentials and send a test message to one phone number.',
        'Go to Attendance → Daily Attendance. A teacher should now be able to select their class and mark the first register.',
      ]},
      { type: 'tip', text: 'Do not skip Academic Settings — classes, learners and attendance all depend on it.' },
    ]
  },
  {
    id: 'gs-2', category: 'Getting Started', audience: ['TEACHER'],
    title: 'Teacher quick start',
    icon: GraduationCap, iconColor: 'text-blue-600',
    body: [
      { type: 'p', text: 'As a teacher your main daily tasks are marking attendance and entering assessment scores.' },
      { type: 'steps', items: [
        'Log in. Your dashboard shows the classes assigned to you.',
        'Go to Attendance → Daily Attendance. Select the correct date and your class. Mark each learner as Present, Absent, Late, or Excused.',
        'For assessments, go to Assessments → Summative Assessments. Select the test and enter scores for each learner.',
        'To view a learner\'s attendance history, go to Presence Platform → Learner Timeline and search by name.',
      ]},
      { type: 'tip', text: 'You can only see learners in your assigned class. If a learner is missing, contact the administrator.' },
    ]
  },
  {
    id: 'gs-3', category: 'Getting Started', audience: ['PARENT'],
    title: 'Parent portal guide',
    icon: UserCheck, iconColor: 'text-purple-600',
    body: [
      { type: 'p', text: 'The parent portal gives you real-time visibility into your child\'s school life.' },
      { type: 'steps', items: [
        'Log in with the phone number the school registered for you. You will receive a one-time code via SMS.',
        'Your dashboard shows your child\'s attendance summary, recent results and fee balance.',
        'Tap Attendance to see your child\'s daily presence record. Tap any date to see the full-day timeline.',
        'Tap Results to view assessment scores and progress reports.',
        'Tap School Fees to see your balance, invoices and payment history.',
        'If your child has received an absence notification via SMS, reply OK to acknowledge it.',
      ]},
      { type: 'tip', text: 'If you have more than one child at this school, you can switch between them from the top of the screen.' },
    ]
  },

  // ── ATTENDANCE ───────────────────────────────────────────────────────────────
  {
    id: 'att-1', category: 'Attendance', audience: ['ADMIN','SUPER_ADMIN','HEAD_TEACHER','TEACHER'],
    title: 'How to mark daily attendance',
    icon: Activity, iconColor: 'text-lime-600',
    body: [
      { type: 'p', text: 'Daily attendance must be marked before the lock time configured by your administrator (default 9:00 AM).' },
      { type: 'steps', items: [
        'Go to Attendance → Daily Attendance.',
        'Select the date (defaults to today) and your class.',
        'The register shows all active learners in the class.',
        'Click each learner\'s status: Present, Absent, Late, Excused, or Sick.',
        'For Late or Excused, you must enter a brief remark explaining why.',
        'Click Save / Submit when all learners are marked.',
      ]},
      { type: 'tip', text: 'If you miss the lock time, contact an administrator. They can approve an unlock request.' },
      { type: 'warning', text: 'Never mark all learners as Present without actually checking. The system flags statistically suspicious registers.' },
    ]
  },
  {
    id: 'att-2', category: 'Attendance', audience: ['PARENT'],
    title: 'Understanding your child\'s attendance',
    icon: Activity, iconColor: 'text-lime-600',
    body: [
      { type: 'p', text: 'Your child\'s attendance is recorded every school day. You can see the full history at any time.' },
      { type: 'steps', items: [
        'Open the Parent Portal and tap Attendance.',
        'The summary shows total days present, absent, late and excused for the current term.',
        'Tap any date in the calendar to see the full-day timeline — including gate arrival, class mark, and bus boarding.',
        'If your child was absent, you will receive an SMS at 9:30 AM on that day.',
        'Reply OK to the SMS to acknowledge the absence.',
      ]},
      { type: 'info', text: 'The attendance rate shown is calculated from all marked days. Unmarked days are not included.' },
    ]
  },
  {
    id: 'att-3', category: 'Attendance', audience: ['ADMIN','SUPER_ADMIN','HEAD_TEACHER'],
    title: 'Absence SMS notifications',
    icon: MessageSquare, iconColor: 'text-cyan-600',
    body: [
      { type: 'p', text: 'TrendSCORE automatically sends an SMS to parents every school morning when their child is absent.' },
      { type: 'steps', items: [
        'The system checks for absent/unmarked learners at 9:30 AM EAT on school days.',
        'An SMS is sent to the parent\'s primary contact phone number.',
        'Parents can reply OK to acknowledge — this records their acknowledgement and notifies the class teacher.',
        'Failed SMS attempts are retried automatically up to 3 times.',
        'All sent messages are logged under Communication → Message History.',
      ]},
      { type: 'tip', text: 'SMS notifications only fire on working days. Configure working days under School Settings.' },
      { type: 'warning', text: 'Ensure parent phone numbers are in the Kenyan format: 07xxxxxxxx or +2547xxxxxxxx.' },
    ]
  },

  // ── PRESENCE PLATFORM ────────────────────────────────────────────────────────
  {
    id: 'pres-1', category: 'Presence Platform', audience: ['ADMIN','SUPER_ADMIN','HEAD_TEACHER'],
    title: 'What is the Presence Platform?',
    icon: Activity, iconColor: 'text-blue-600',
    body: [
      { type: 'p', text: 'The Presence Platform is TrendSCORE\'s unified tracking layer. Instead of each module recording attendance separately, every presence event — class register, gate scan, bus boarding, dorm roll call — flows into one place.' },
      { type: 'p', text: 'This means you can answer questions like: "Was this learner at school today?" and "Did they board the morning bus but never reach class?" without checking three separate modules.' },
      { type: 'steps', items: [
        'School Snapshot (Presence Platform → School Snapshot): real-time counts of present, absent and unmarked learners across the whole school.',
        'Learner Timeline (Presence Platform → Learner Timeline): every event for a specific learner on a specific day, in chronological order.',
        'Analytics Dashboard: trends, at-risk learners, late patterns and early warning violations.',
      ]},
      { type: 'info', text: 'Presence events are generated automatically from attendance marks, biometric scans, bus boarding records and boarding roll calls. No extra action is needed.' },
    ]
  },
  {
    id: 'pres-2', category: 'Presence Platform', audience: ['ADMIN','SUPER_ADMIN','HEAD_TEACHER','TEACHER'],
    title: 'Reading a learner\'s presence timeline',
    icon: Activity, iconColor: 'text-blue-600',
    body: [
      { type: 'p', text: 'The timeline shows every presence event for a learner on a given day, earliest first.' },
      { type: 'steps', items: [
        'Go to Presence Platform → Learner Timeline.',
        'Enter the learner\'s name or admission number.',
        'The default view shows today. Use the date arrows to navigate to any previous day.',
        'Each event card shows the time, description, location, and source (Manual / Biometric / Driver).',
        'A green "Marked Present" card means a class register was saved.',
        'A blue "Arrived at School Gate" card means a biometric device recorded arrival.',
        'An amber "Boarded Route X Bus" card means the driver confirmed boarding.',
      ]},
      { type: 'tip', text: 'If a learner has a bus boarding event but no class attendance, the Analytics dashboard flags this as BUS_NO_ARRIVAL.' },
    ]
  },
  {
    id: 'pres-3', category: 'Presence Platform', audience: ['ADMIN','SUPER_ADMIN','HEAD_TEACHER'],
    title: 'Early warning alerts explained',
    icon: AlertTriangle, iconColor: 'text-amber-600',
    body: [
      { type: 'p', text: 'The system automatically monitors four signals and creates a violation record when triggered.' },
      { type: 'steps', items: [
        'CHRONIC_ABSENT — learner has an absence rate above 20% over the past 4 weeks. Alert goes to class teacher and head teacher.',
        'LATE_PATTERN — learner was marked Late 3 or more times in the past 5 school days. Alert goes to class teacher.',
        'BUS_NO_ARRIVAL — learner boarded the school bus but no class attendance was recorded within 90 minutes. Alert goes to administrator.',
        'DORM_ABSCOND — learner was present in class but absent from the night roll call. Alert goes to house master and administrator.',
      ]},
      { type: 'tip', text: 'Violations can be resolved once the situation is addressed. Resolved violations do not reappear in reports.' },
      { type: 'info', text: 'Early warning checks run automatically every night. You can also trigger them manually from the Analytics dashboard.' },
    ]
  },

  // ── BOARDING ─────────────────────────────────────────────────────────────────
  {
    id: 'board-1', category: 'Boarding', audience: ['ADMIN','SUPER_ADMIN','HEAD_TEACHER'],
    title: 'Setting up dormitories',
    icon: Home, iconColor: 'text-indigo-600',
    body: [
      { type: 'p', text: 'Before running roll calls or managing exeat, you need at least one dormitory configured.' },
      { type: 'steps', items: [
        'Go to Boarding → Boarding Hub.',
        'Click Add Dormitory. Enter the name (e.g. Block A), gender (Boys / Girls / Mixed) and total capacity.',
        'Optionally add a block identifier (e.g. North Wing).',
        'Repeat for each physical dormitory block.',
        'After creating dormitories, go to Assignments to assign boarders to their dorms and beds.',
        'Go to House Masters to assign staff members as house masters for each dormitory.',
      ]},
      { type: 'tip', text: 'A learner can only be in one active dormitory assignment at a time. Assigning them to a new dorm automatically closes the previous one.' },
    ]
  },
  {
    id: 'board-2', category: 'Boarding', audience: ['ADMIN','SUPER_ADMIN','HEAD_TEACHER'],
    title: 'Running a roll call',
    icon: CheckCircle2, iconColor: 'text-indigo-600',
    body: [
      { type: 'p', text: 'Roll calls are conducted twice daily — morning and night. Each roll call is tied to a specific dormitory and session.' },
      { type: 'steps', items: [
        'Go to Boarding → Boarding Hub and click Start Roll Call.',
        'Select the dormitory, session (MORNING or NIGHT) and date.',
        'The system creates an IN_PROGRESS roll call — only one can exist per dorm per session per day.',
        'Mark each boarder: Present, Absent, Excused, or On Exeat.',
        'Use Bulk Mark to mark all as Present, then individually change absent learners.',
        'Click Complete Roll Call when all entries are recorded. This triggers notifications for any absent learners.',
      ]},
      { type: 'warning', text: 'A night roll call with absent learners triggers an immediate alert to the house master and head teacher. Do not complete the roll call until all learners are accounted for.' },
      { type: 'tip', text: 'Boarders on approved exeat should be marked as On Exeat — this does not count as an absence.' },
    ]
  },
  {
    id: 'board-3', category: 'Boarding', audience: ['ADMIN','SUPER_ADMIN','HEAD_TEACHER','PARENT'],
    title: 'Exeat (weekend / leave) process',
    icon: ChevronRight, iconColor: 'text-indigo-600',
    body: [
      { type: 'p', text: 'An exeat is permission for a boarding learner to leave school grounds for a set period.' },
      { type: 'steps', items: [
        'A parent or house master submits an exeat request with departure date, return date, type (Weekend / Medical / Family / Other) and reason.',
        'The house master or administrator reviews and approves or denies the request. The parent receives an SMS with the decision.',
        'On the departure day, the house master records the departure. The learner\'s presence shows as EXEAT_DEPARTED.',
        'On the return day, the house master records the return. The learner\'s presence shows as EXEAT_RETURNED.',
        'If a learner does not return by their return date, an overdue alert is sent to parents and house master the next morning.',
      ]},
      { type: 'info', text: 'Parents: you will receive an SMS when your exeat request is approved or denied, and another if your child does not return on time.' },
    ]
  },

  // ── TRANSPORT ────────────────────────────────────────────────────────────────
  {
    id: 'trans-1', category: 'Transport', audience: ['ADMIN','SUPER_ADMIN','HEAD_TEACHER'],
    title: 'Setting up school transport',
    icon: Bus, iconColor: 'text-rose-600',
    body: [
      { type: 'p', text: 'Configure vehicles and routes before assigning learners.' },
      { type: 'steps', items: [
        'Go to Transport → Bus Routes & Roster.',
        'Click Add Vehicle. Enter the registration number, capacity, driver name and phone.',
        'Click Add Route. Enter the route name, stops description, fee per term and assign the vehicle.',
        'Click the passenger count badge on any route to open the assignment panel.',
        'Search for a learner by name or admission number and click Assign.',
        'The learner\'s transport fee is automatically added to their next invoice.',
      ]},
      { type: 'tip', text: 'A vehicle will show OVER CAPACITY if you assign more learners than its seat count. Reduce assignments or add a larger vehicle.' },
    ]
  },
  {
    id: 'trans-2', category: 'Transport', audience: ['PARENT'],
    title: 'Tracking your child\'s bus',
    icon: Bus, iconColor: 'text-rose-600',
    body: [
      { type: 'p', text: 'You can see your child\'s transport route and receive notifications when they board.' },
      { type: 'steps', items: [
        'Open the Parent Portal and tap Transport.',
        'This shows the route your child is assigned to, the vehicle and driver details.',
        'When the driver confirms your child boarded the morning bus, you will see a "Boarded Route X Bus" event in their daily timeline.',
        'The full-day timeline (Attendance → tap a date) shows bus boarding, school arrival, and class attendance together.',
      ]},
      { type: 'info', text: 'If your child\'s transport status is not updating, contact the school to confirm the driver is recording boarding events.' },
    ]
  },

  // ── BIOMETRICS ───────────────────────────────────────────────────────────────
  {
    id: 'bio-1', category: 'Biometrics', audience: ['ADMIN','SUPER_ADMIN'],
    title: 'Setting up biometric devices',
    icon: Fingerprint, iconColor: 'text-emerald-600',
    body: [
      { type: 'p', text: 'Biometric devices (ZKTeco, NFC readers, gate terminals) can automatically record when learners and staff arrive and leave.' },
      { type: 'steps', items: [
        'Go to Biometric Attendance → Biometric Authority.',
        'Open Terminal Management and select Register terminal. Enter the hardware device ID, name, type, location and synchronization mode.',
        'Copy the one-time device token and store it in the terminal or approved connector. TrendScore stores only its cryptographic digest.',
        'Configure the device to POST events to: https://your-school.trendscore.co.ke/api/biometric/log',
        'Send the one-time device token as an Authorization: Bearer header. The JSON payload should include: deviceId, personId (admission number or staff ID), personType (LEARNER or STAFF), timestamp and direction (IN/OUT).',
        'Send one authenticated test scan, then select Test on the terminal card within ten minutes to complete verification.',
        'Once configured, each scan creates a GATE_ENTRY or GATE_EXIT event visible in the learner\'s presence timeline.',
      ]},
      { type: 'tip', text: 'Direct PUSH mode requires the canonical TrendScore JSON contract. Vendor-native ZKTeco payloads need an approved connector; compatible PULL installations also require a network-reachable device IP.' },
      { type: 'p', text: 'For phone face attendance, register a PHONE terminal, choose Activate phone, and open /#/terminal/biometric. Enroll each learner or staff member under Biometric Authority first. AWS liveness and face matching require internet; manual attendance is the only fallback and can queue offline.' },
      { type: 'warning', text: 'The device token must be kept secret. If a device is stolen, rotate its token immediately from Terminal Management. Never place the platform biometric encryption key on a terminal.' },
    ]
  },

  // ── FEES ──────────────────────────────────────────────────────────────────────
  {
    id: 'fee-1', category: 'School Fees', audience: ['PARENT'],
    title: 'Understanding your fee statement',
    icon: CreditCard, iconColor: 'text-red-600',
    body: [
      { type: 'p', text: 'Your fee statement shows all charges, payments and current balance for each child.' },
      { type: 'steps', items: [
        'Open the Parent Portal and tap School Fees.',
        'Select the child (if you have more than one).',
        'The statement shows the invoice for the current term: tuition, transport, activities and other fees.',
        'Payments you have made are listed below the invoice, reducing the balance.',
        'If you see Unmatched Payment, it means a payment was received but could not be automatically matched to your account. Contact the school bursar.',
      ]},
      { type: 'info', text: 'Your school may send an SMS fee reminder before due dates. You can also view your full payment history at any time.' },
    ]
  },

  // ── ASSESSMENTS ───────────────────────────────────────────────────────────────
  {
    id: 'assess-1', category: 'Assessments', audience: ['PARENT'],
    title: 'Viewing your child\'s results',
    icon: BarChart3, iconColor: 'text-amber-600',
    body: [
      { type: 'p', text: 'Assessment results are available in the parent portal as soon as the teacher publishes them.' },
      { type: 'steps', items: [
        'Open the Parent Portal and tap Results.',
        'Select the term and type (Formative or Summative).',
        'Tap any assessment to see the full score breakdown by subject.',
        'The grade and performance level shown match the school\'s official grading scale.',
        'If results are not yet visible, they may not have been published by the teacher. Check back later or contact the school.',
      ]},
      { type: 'info', text: 'When results are published, you will receive an SMS with the summary. The full breakdown is available in the portal.' },
    ]
  },

  // ── ANALYTICS ─────────────────────────────────────────────────────────────────
  {
    id: 'anal-1', category: 'Analytics', audience: ['ADMIN','SUPER_ADMIN','HEAD_TEACHER'],
    title: 'Reading the Analytics dashboard',
    icon: BarChart3, iconColor: 'text-indigo-600',
    body: [
      { type: 'p', text: 'The Analytics dashboard gives you a data-driven view of attendance health across the school.' },
      { type: 'steps', items: [
        'Go to Attendance Intelligence → Analytics Dashboard.',
        'The Overview tab shows today\'s headline numbers and a 7-day trend chart.',
        'The At-Risk tab ranks learners by their absence rate over the past 28 days. Sort by Risk Level to prioritise follow-ups.',
        'The Late Patterns tab shows which grades have the most repeated late arrivals — useful for spotting bus or timetable issues.',
        'The Violations tab shows all open early warning flags. Click Resolve when a case has been followed up.',
        'Click Run Checks to trigger all early warning signals immediately (also runs every night automatically).',
      ]},
      { type: 'tip', text: 'Export is not yet built in — screenshot or print the at-risk list for staff meetings.' },
    ]
  },
];

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',                  label: 'All Topics',          icon: BookOpen },
  { id: 'Getting Started',      label: 'Getting Started',     icon: Star },
  { id: 'Attendance',           label: 'Attendance',          icon: Activity },
  { id: 'Presence Platform',    label: 'Presence',            icon: Activity },
  { id: 'Boarding',             label: 'Boarding',            icon: Home },
  { id: 'Transport',            label: 'Transport',           icon: Bus },
  { id: 'Biometrics',           label: 'Biometrics',          icon: Fingerprint },
  { id: 'School Fees',          label: 'School Fees',         icon: CreditCard },
  { id: 'Assessments',          label: 'Assessments',         icon: BarChart3 },
  { id: 'Analytics',            label: 'Analytics',           icon: BarChart3 },
];

const AUDIENCE_LABELS = {
  ADMIN: 'Admin', SUPER_ADMIN: 'Admin', HEAD_TEACHER: 'Admin',
  TEACHER: 'Teacher', PARENT: 'Parent',
};

// ── Article renderer ──────────────────────────────────────────────────────────
const ArticleBody = ({ blocks }) => (
  <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
    {blocks.map((b, i) => {
      if (b.type === 'p')   return <p key={i}>{b.text}</p>;
      if (b.type === 'steps') return (
        <ol key={i} className="space-y-2 pl-1">
          {b.items.map((item, j) => (
            <li key={j} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">{j+1}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      );
      if (b.type === 'tip') return (
        <div key={i} className="flex gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
          <Lightbulb size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-amber-800 text-xs">{b.text}</p>
        </div>
      );
      if (b.type === 'warning') return (
        <div key={i} className="flex gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
          <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-xs">{b.text}</p>
        </div>
      );
      if (b.type === 'info') return (
        <div key={i} className="flex gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
          <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-blue-800 text-xs">{b.text}</p>
        </div>
      );
      return null;
    })}
  </div>
);

// ── ArticleCard ────────────────────────────────────────────────────────────────
const ArticleCard = ({ article, expanded, onToggle }) => {
  const Icon = article.icon;
  const audiences = [...new Set(article.audience.map(a => AUDIENCE_LABELS[a]).filter(Boolean))];
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50/50 transition"
      >
        <div className={`w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 ${article.iconColor}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight">{article.title}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{article.category}</span>
            {audiences.map(a => (
              <span key={a} className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{a}</span>
            ))}
          </div>
        </div>
        {expanded ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0 mt-1" /> : <ChevronRight size={16} className="text-gray-400 flex-shrink-0 mt-1" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3">
          <ArticleBody blocks={article.body} />
        </div>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const KnowledgeBase = () => {
  const [search, setSearch]       = useState('');
  const [category, setCategory]   = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const filtered = useMemo(() => {
    let items = ARTICLES;
    if (category !== 'all') items = items.filter(a => a.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.body.some(b => (b.text || b.items?.join(' ') || '').toLowerCase().includes(q))
      );
    }
    return items;
  }, [search, category]);

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_50%,white,transparent_60%)]" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen size={28} className="text-white/80" />
            <span className="text-white/70 text-sm font-semibold uppercase tracking-widest">Help Centre</span>
          </div>
          <h1 className="text-3xl font-bold mb-1">{PRODUCT_DISPLAY_NAME} Knowledge Base</h1>
          <p className="text-blue-100 mb-6 text-sm">Guides for administrators, teachers, parents and boarding staff.</p>
          <div className="relative max-w-lg">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search guides, e.g. 'mark attendance' or 'exeat'…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-gray-900 bg-white/95 border-0 focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(cat => {
          const CatIcon = cat.icon;
          const count = cat.id === 'all' ? ARTICLES.length : ARTICLES.filter(a => a.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                category === cat.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              <CatIcon size={12} />
              {cat.label}
              <span className={`ml-0.5 ${category === cat.id ? 'text-indigo-200' : 'text-gray-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Article count */}
      <p className="text-xs text-gray-400 mb-4">
        {filtered.length} article{filtered.length !== 1 ? 's' : ''}
        {search && ` matching "${search}"`}
        {category !== 'all' && !search && ` in ${category}`}
      </p>

      {/* Articles */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <HelpCircle size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No articles found</p>
          <p className="text-xs mt-1">Try a different search or category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(article => (
            <ArticleCard
              key={article.id}
              article={article}
              expanded={expandedId === article.id}
              onToggle={() => setExpandedId(expandedId === article.id ? null : article.id)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-10 p-5 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-800">Can't find what you need?</p>
          <p className="text-xs text-gray-400 mt-0.5">Contact your school administrator or the support team.</p>
        </div>
        <div className="flex gap-2">
          <a href="mailto:support@trendscore.co.ke"
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20">
            Email Support
          </a>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
