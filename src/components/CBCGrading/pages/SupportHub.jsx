/**
 * Help & Documentation Page - ENHANCED VERSION
 * Comprehensive user guide and knowledge base
 */

import React, { useEffect, useState } from 'react';
import { Book, Search, ChevronDown, ChevronRight, HelpCircle, FileText, Video, Mail, MessageSquare, Settings, ScanFace } from 'lucide-react';
import { PRODUCT_SUPPORT_EMAIL } from '../../../config/productIdentity';

const SupportHub = ({ initialQuery = '', initialSection = '' }) => {
  const [searchTerm, setSearchTerm] = useState(initialQuery || '');
  const [expandedSections, setExpandedSections] = useState(initialSection ? { [initialSection]: true } : {});

  useEffect(() => {
    setSearchTerm(initialQuery || '');
    if (initialSection) setExpandedSections(prev => ({ ...prev, [initialSection]: true }));
  }, [initialQuery, initialSection]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const helpSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: Book,
      color: 'blue',
      articles: [
        {
          title: 'System Overview',
          content: 'The CBC Grading System helps you manage learner records, attendance, assessments, and generate reports according to CBC curriculum standards. It includes integrated communication features for Email, SMS, and M-Pesa payments.'
        },
        {
          title: 'Dashboard Overview',
          content: 'The dashboard shows key statistics including total learners, teachers, attendance rates, and recent activities at a glance. Use it to quickly understand your school\'s status.'
        },
        {
          title: 'Navigation Guide',
          content: 'Use the sidebar to navigate between different modules: Learners, Teachers, Parents, Attendance, Assessment, Reports, Messages, Notices, and Settings.'
        },
        {
          title: 'First Time Setup',
          content: 'After logging in for the first time: 1) Configure School Settings 2) Set up Academic Year/Terms 3) Add Teachers 4) Configure Communication Settings (Email, SMS, M-Pesa) 5) Start adding learners.'
        }
      ]
    },
    {
      id: 'communications',
      title: 'Communication Settings',
      icon: MessageSquare,
      color: 'cyan',
      articles: [
        {
          title: 'Email Integration Setup',
          content: 'Go to Settings → Communication Settings → Email tab. Choose a provider (Resend recommended for 3K free emails/month, or SendGrid for 100/day free). Get an API key from the provider\'s website, enter it along with your "From Email" and "From Name". Save settings and test with a real email address.'
        },
        {
          title: 'SMS Integration Setup',
          content: 'Go to Settings → Communication → SMS. Configure the SMS provider enabled for your school, including the MobileSasa API credentials and approved Sender ID where applicable. Save the settings, then send a test to a Kenyan number in 254712345678 format. A successful test and sufficient SMS balance are required before bulk messaging.'
        },
        {
          title: 'M-Pesa Integration Setup',
          content: 'Go to Settings → Communication Settings → M-Pesa tab. IntaSend is easiest (no Paybill needed, setup in 15 minutes). Sign up at intasend.com, get Public Key and Secret Key, enter Business Number. For production, Safaricom Daraja has lowest fees but requires Paybill number and takes 2-4 weeks approval. Save settings and test with phone number and small amount (KES 10).'
        },
        {
          title: 'Testing Integrations',
          content: 'After configuring Email, SMS, or M-Pesa, use the matching Test section. For SMS, send one message to a controlled phone number and confirm both delivery and the Message History record. For M-Pesa, confirm the STK prompt arrives. If a test fails, review the provider response shown by the system before changing credentials.'
        },
        {
          title: 'Troubleshooting Communication Issues',
          content: 'Email not sending? Check the API key and verified From Email domain. SMS not delivering? Verify 254 phone format, SMS balance, approved Sender ID, and the exact MobileSasa response in Message History. Duplicate-message responses normally mean the provider received the same phone and body too quickly; use Retry only after reviewing the message. M-Pesa failing? Confirm the registered phone, business number, and configured credentials.'
        },
        {
          title: 'Recommended Providers for Schools',
          content: 'Use only providers configured and approved for your school. TrendScore supports school-specific communication credentials; MobileSasa is the current SMS path for schools configured to use it. Keep provider credentials private, monitor balances, and always test after changing settings.'
        }
      ]
    },
    {
      id: 'learners',
      title: 'Managing Learners',
      icon: FileText,
      color: 'green',
      articles: [
        {
          title: 'Adding New Learners',
          content: 'Click "Add Learner" button → Navigate to Admissions page → Fill the 4-step form: Step 1 (Personal Info: name, date of birth, gender, grade), Step 2 (Guardian Details: name, phone, email, relationship), Step 3 (Medical Info: allergies, conditions, emergency contact), Step 4 (Review & Submit). The learner will be added with "Active" status.'
        },
        {
          title: 'Editing Learner Information',
          content: 'Go to Learners List → Find the learner using search or filters → Click the green edit icon → Update any information across all tabs → Save changes. Changes are immediate and reflected in all reports.'
        },
        {
          title: 'Viewing Learner Details',
          content: 'Click the blue eye icon next to any learner to view complete profile including personal details, academic information (current grade, admission date), guardian contact info, and medical records.'
        },
        {
          title: 'Promoting Learners to Next Grade',
          content: 'At end of academic year: Go to Learner Management → Promotion → Select current grade → View list of learners eligible for promotion → Click "Promote All" or select specific learners → Confirm promotion. Learners move to next grade automatically.'
        },
        {
          title: 'Transfers & Exits',
          content: 'Transfer Out: Learner Management → Transfer Out → Select learner, enter transfer date, destination school, reason → Submit. This marks learner as "Transferred". Exit/Withdrawal: Click orange exit icon → Enter reason and date → Confirm. Learner status becomes "Exited".'
        },
        {
          title: 'Bulk Import Learners',
          content: 'Download a fresh template from Admissions → Bulk Import. Complete the required learner and class fields, using First Name plus Other Names when a separate surname is unavailable. Upload the file and review the preview carefully: correct validation errors, confirm names and grades, then import. The importer must never create placeholder words such as "Student" as part of a learner name.'
        }
      ]
    },
    {
      id: 'attendance',
      title: 'Attendance Management',
      icon: FileText,
      color: 'purple',
      articles: [
        {
          title: 'Marking Daily Attendance',
          content: 'Go to Daily Attendance → Select date (defaults to today), grade, and stream → System loads all learners in that class → Click Present, Absent, Late, or Excused for each learner → Use "Mark All Present" for quick entry → Save. You can also add notes for individual learners.'
        },
        {
          title: 'Viewing Attendance Reports',
          content: 'Navigate to Attendance Reports and choose the attendance type, date range, and available grade or staff filters. Generate the report to review present, absent, late, and excused totals and percentages. Records that require an unlock or correction must follow the approval flow so the original entry, approver, reason, and corrected value remain auditable.'
        },
        {
          title: 'Understanding Attendance Status',
          content: 'Present (Green): Learner attended class. Absent (Red): Learner did not attend without valid reason. Late (Yellow): Learner arrived after start time. Excused (Blue): Learner has valid reason for absence (sick note, family emergency). Use notes field to add details.'
        },
        {
          title: 'Attendance Notifications',
          content: 'When SMS is configured: System can auto-send messages to parents when learner is marked absent. Go to Settings → Notifications → Enable "Attendance Alerts" → Set time (e.g., 11 AM daily) → Parents receive SMS: "Your child [Name] was absent today. Please contact school."'
        },
        {
          title: 'Weekly & Monthly Attendance Summaries',
          content: 'Use Attendance Reports with date range filters to view weekly/monthly trends. Identify learners with low attendance (below 80%) for early intervention. Export summary reports for school administration or Ministry of Education compliance.'
        }
      ]
    },
    {
      id: 'biometrics',
      title: 'Biometric Attendance',
      icon: ScanFace,
      color: 'indigo',
      articles: [
        {
          title: 'Module Overview and Readiness',
          content: 'Biometric Attendance uses an activated phone camera, AWS Face Liveness, a school-scoped face collection, and TrendSCORE attendance records. Before enrolling anyone, open Biometric Attendance → API & Bridge Info and confirm both Encryption ready and FACE READY. AWS access keys and the biometric encryption key belong only in protected deployment secrets; they must never be entered into the app, phone, terminal link, or screenshots.'
        },
        {
          title: 'Registering and Activating a Phone Terminal',
          content: 'Open Terminal Management → Register terminal. Enter a stable hardware ID, name, PHONE type, location, serial number where available, and PUSH sync mode. Choose Activate phone, open the displayed terminal link on the intended phone, and enter the one-use 8-digit code within ten minutes. Keep using the same browser profile because the protected device token is stored there. If browser storage is cleared or the phone is replaced, issue a new activation code; this rotates the terminal token and invalidates the old session.'
        },
        {
          title: 'Consent-Based Face Enrollment',
          content: 'Open Face Enrollment, find the learner or staff member, and review their enrollment status. Confirm that documented parent or guardian consent, or staff consent, and the school-approved biometric purpose are on record. Select Start live face enrollment and let that named person complete the AWS liveness challenge in even lighting. TrendSCORE stores an encrypted AWS face reference rather than the camera video. Revoke the credential immediately when consent is withdrawn or the person leaves.'
        },
        {
          title: 'Recording Face Attendance',
          content: 'On the activated phone select LEARNER or STAFF and choose CHECK IN or CHECK OUT. Select Start face recognition, allow camera access for the school site, and let the person complete the liveness challenge. TrendSCORE records attendance only when liveness and face matching meet the configured thresholds. A fresh AWS session is created for each attempt and expires after three minutes; failed or cancelled sessions should be restarted rather than reused.'
        },
        {
          title: 'Manual Fallback and Offline Use',
          content: 'Select Use manual fallback when face recognition is unavailable or does not match. Enter the learner admission number or staff ID and confirm the correct direction. Face recognition always requires internet, but manual events captured offline are queued in the phone browser and synchronize in order when connectivity returns. Do not treat manual fallback as a successful biometric match; review repeated failures and re-enroll only after revoking the previous face credential.'
        },
        {
          title: 'Attendance Data Feed and Connection Testing',
          content: 'After a test, open Attendance Data Feed and confirm the correct person, direction, timestamp, terminal, FACE modality, liveness result and confidence values. In Terminal Management choose Test connection after a recent authenticated scan or heartbeat. Investigate pending or failed logs before retrying them so duplicate attendance is not created. Event IDs are unique per terminal, making safe retries return the existing result.'
        },
        {
          title: 'Security and Terminal Maintenance',
          content: 'Use one terminal record and token per physical phone. Rotate the token immediately if it is exposed, remove the local terminal configuration before repurposing a phone, and decommission lost, stolen or retired devices. Decommissioning blocks new events while preserving audit history. Never share one Demo School terminal link, token, face enrollment, or biometric encryption key with another school.'
        },
        {
          title: 'Rolling Out to Another School',
          content: 'First deploy that school with protected AWS region, server credentials and liveness role configuration, then confirm FACE READY. TrendSCORE creates a separate AWS face collection for the school automatically. The school must register and activate its own phone terminals, record its own consent, and enroll its own learners and staff. Existing Demo School terminals and enrollments are intentionally not copied. Run one controlled check-in, verify it in Attendance Data Feed, and complete the go-live checklist before wider use.'
        },
        {
          title: 'Troubleshooting Face Attendance',
          content: 'If a session cannot start, check FACE READY, internet access, camera permission, AWS region and the deployment verification result. If liveness fails, improve lighting, keep the face centered and start a new session. If liveness passes but no face matches, confirm that the person has an active FACE enrollment in the current school. If the terminal reports authorization expired, create a new activation code. Use manual fallback while resolving the cause.'
        }
      ]
    },
    {
      id: 'assessment',
      title: 'CBC Assessment & Grading',
      icon: FileText,
      color: 'orange',
      articles: [
        {
          title: 'Formative Assessment',
          content: 'Go to Formative Assessment → Select Term, Grade, Learning Area → Choose learner → Rate competencies using rubrics: EE (Exceeds Expectations) - Outstanding, ME (Meets Expectations) - Satisfactory, AE (Approaches Expectations) - Developing, BE (Below Expectations) - Needs support → Add detailed comments on strengths and areas for improvement → Save.'
        },
        {
          title: 'Understanding CBC Rubrics',
          content: 'EE (Exceeds Expectations): Learner demonstrates exceptional understanding, applies knowledge creatively, helps others. ME (Meets Expectations): Learner achieves expected competencies, works independently. AE (Approaches Expectations): Learner shows progress but needs more practice. BE (Below Expectations): Learner struggles, requires additional support and intervention.'
        },
        {
          title: 'Summative Tests & Scoring',
          content: 'Go to Summative Tests and create or select the exact assessment series and subject. Enter marks against the correct learner, grade, term, and exam, then publish only after checking the summary. Before bulk SMS distribution, use the preview to confirm the exam name and each learner\'s real scores. Message History records successful and failed attempts with the grade, message body, and provider response.'
        },
        {
          title: 'Generating CBC Reports',
          content: 'Formative Reports: Shows rubric ratings across all learning areas for selected term. Summative Sheets: Displays test scores, grades, percentages for compact learner, grade, and stream outputs. Official Report Cards: Comprehensive parent-facing reports combining formative assessments, summative tests, attendance, teacher comments, and head teacher remarks. Select learner → Generate → Download PDF or Print.'
        },
        {
          title: 'Grade Level Learning Areas',
          content: 'Lower Primary (1-3): English, Kiswahili, Indigenous Language, Mathematical Activities, Environmental Activities, Religious Education, Creative Activities. Upper Primary (4-6): English, Kiswahili, Science and Technology, Social Studies, Mathematics, Agriculture, Creative Arts, Religious Education. Junior School (7-9): Integrated Science, Social Studies, Pre-Technical Studies, Agriculture, Creative Arts & Sports.'
        },
        {
          title: 'Parent Report Distribution',
          content: 'After generating reports, either print the approved report or use the configured bulk communication action. Always review the message preview before sending. The message should identify the school and exact assessment name and must show the learner\'s stored scores. Use Communications → Message History to inspect delivery status, failures, grade, provider response, and the exact message body.'
        }
      ]
    },
    {
      id: 'settings',
      title: 'System Settings & Configuration',
      icon: Settings,
      color: 'gray',
      articles: [
        {
          title: 'School Information',
          content: 'Settings → School Settings → Update: School Name, Physical Address, Phone Number, Email Address, School Motto, Registration Number, Principal/Head Teacher Name → Upload school logo (PNG, max 5MB) → Set time zone for Kenya (EAT) → Save changes. This info appears on all reports and official documents.'
        },
        {
          title: 'Academic Year & Terms Setup',
          content: 'Settings → Academic Settings → Set Current Academic Year (e.g., 2026) → Define Term Dates: Term 1 (January-April): Start Date, End Date, Midterm Break. Term 2 (May-August): Dates. Term 3 (September-December): Dates → Set number of teaching days per term → Save. System uses this for attendance calculations and report generation.'
        },
        {
          title: 'Branding & Customization',
          content: 'Settings → Branding Settings → Upload School Logo → Set Brand Colors (Primary color for headers, Secondary for accents) → Customize Welcome Message for dashboard → Set Report Card Header/Footer text → Choose Color Scheme (default, dark mode, custom) → Apply changes system-wide.'
        },
        {
          title: 'User Management & Permissions',
          content: 'Settings → User Management → Add User: Enter name, email, phone, assign Role (Admin, Teacher, Class Teacher, Accountant) → Set Permissions: What modules user can access (Learners, Assessment, Reports, Settings) → Generate password or let user set → Send login credentials via email → Manage existing users: Edit, Deactivate, Reset password.'
        },
        {
          title: 'Backup & Data Export',
          content: 'Settings → Backup Settings → Enable Automatic Backups (daily, weekly, monthly) → Cloud storage: Connect Google Drive or Dropbox → Manual Backup: Click "Backup Now" → Downloads full database export → Restore: Upload previous backup file → Confirm restore (WARNING: Overwrites current data).'
        },
        {
          title: 'Notification Preferences',
          content: 'Settings → Notifications → Enable/Disable: Attendance Alerts (SMS to parents for absences), Assessment Reminders (Email to teachers), Fee Payment Alerts (SMS when M-Pesa received), Report Card Ready (Email to parents) → Set notification schedules → Test notifications to ensure working.'
        }
      ]
    },
    {
      id: 'grades',
      title: 'Grade Levels & Curriculum',
      icon: FileText,
      color: 'indigo',
      articles: [
        {
          title: 'Early Years Education (ECDE)',
          content: 'Crèche (0-2 years): Play-based learning, sensory activities. Reception (2-3 years): Social skills, basic motor development. Playgroup (3-4 years): Pre-reading, pre-math, creative play. Pre-Primary 1 (PP1, 4-5 years): Early literacy, numeracy, art. Pre-Primary 2 (PP2, 5-6 years): School readiness, foundational competencies.'
        },
        {
          title: 'Lower Primary (Grades 1-3)',
          content: 'Core Learning Areas: Mathematics (Number work, patterns, shapes), English Activities (Reading, Writing, Speaking), Kiswahili (Kusoma, Kuandika, Kuzungumza), Environmental Activities (Social, Science concepts), Religious Education (CRE/IRE/HRE), Creative Arts (Art & Craft, Music), Physical Education (Games, movement). Focus on play-based, activity-centered learning.'
        },
        {
          title: 'Upper Primary (Grades 4-6)',
          content: 'Expanded Curriculum: Multi-disciplinary approach focusing on Science and Technology, Social Studies, Mathematics, and Agriculture. Emphasis on formative and summative assessments to measure competencies in real-world contexts.'
        },
        {
          title: 'Junior School (Grades 7-9)',
          content: 'Subject Areas: Languages (English, Kiswahili, Optional Foreign), Mathematics, Integrated Science, Health Education, Pre-Technical & Pre-Career, Social Studies, Religious Education, Sports & Physical Education. Introduction to electives and career pathways. Focus on competency-based assessment.'
        },
        {
          title: 'Senior School (Grades 10-12)',
          content: 'Specialized Pathways: STEM (Science, Technology, Engineering, Math), Social Sciences, Arts & Sports, Technical & Vocational. Learners choose pathway based on interests and aptitudes. Advanced subjects, projects, internships. Preparation for university, TVET, or employment.'
        }
      ]
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting & FAQs',
      icon: HelpCircle,
      color: 'red',
      articles: [
        {
          title: 'Cannot Login',
          content: 'Check: 1) Username/email correct? 2) Password correct (case-sensitive)? 3) Account activated by admin? 4) Internet connection stable? 5) Browser cache cleared? If still failing, contact admin for password reset. Use "Forgot Password" link on login page.'
        },
        {
          title: 'Learner Not Appearing in List',
          content: 'Check Filters: 1) Is correct grade selected? 2) Status filter set to "Active"? (Exited learners hidden by default) 3) Search term spelled correctly? 4) Learner actually added to system? Go to Admissions to verify. If missing, re-add learner.'
        },
        {
          title: 'Report Generation Failing',
          content: 'Common causes: 1) No assessments entered for selected term → Enter formative/summative data first. 2) Learner has no marks → Ensure all subjects assessed. 3) Browser blocking pop-ups → Allow pop-ups for this site. 4) Slow internet → Wait for generation to complete. Try exporting as PDF instead of printing directly.'
        },
        {
          title: 'System Running Slow',
          content: 'Solutions: 1) Close unnecessary browser tabs 2) Clear browser cache & cookies 3) Use Chrome/Edge (better performance) 4) Check internet speed (minimum 2 Mbps recommended) 5) If many users online, performance may dip - schedule heavy tasks (bulk imports, reports) during off-peak hours.'
        },
        {
          title: 'M-Pesa Payment Not Reflecting',
          content: 'Wait time: M-Pesa confirmations take 30 seconds to 5 minutes. Check: 1) Transaction ID sent to phone? 2) Correct business number used? 3) M-Pesa callback URL configured? 4) Check Payment History in system. If payment made but not showing after 10 minutes, contact support with M-Pesa message screenshot.'
        },
        {
          title: 'How to Reset/Change Password',
          content: 'For your account: Settings → User Profile → Change Password → Enter current password, new password (min 8 characters), confirm → Save. For another user (Admin only): Settings → User Management → Find user → Click edit → Click "Reset Password" → Send new password via email or SMS.'
        }
      ]
    }
  ];

  const filteredSections = helpSections.map(section => ({
    ...section,
    articles: section.articles.filter(article =>
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.content.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(section => section.articles.length > 0);

  return (
    <div className="space-y-6">

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for help articles... (e.g., 'SMS setup', 'add learner', 'attendance')"
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          💡 Tip: Try searching "email", "sms", "m-pesa", "attendance", "assessment", or any feature you need help with
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <a
          href="#getting-started"
          className="bg-blue-500 text-white rounded-xl p-6 hover:from-blue-600 hover:to-blue-700 transition cursor-pointer"
        >
          <Book size={32} className="mb-3" />
          <h3 className="font-medium text-lg mb-2">Getting Started</h3>
          <p className="text-blue-100 text-sm">New user? Start here</p>
        </a>

        <a
          href="#communications"
          className="bg-cyan-500 text-white rounded-xl p-6 hover:from-cyan-600 hover:to-cyan-700 transition cursor-pointer"
        >
          <MessageSquare size={32} className="mb-3" />
          <h3 className="font-medium text-lg mb-2">Communications</h3>
          <p className="text-cyan-100 text-sm">Email, SMS, M-Pesa setup</p>
        </a>

        <a
          href="#video-tutorials"
          className="bg-purple-500 text-white rounded-xl p-6 hover:from-purple-600 hover:to-purple-700 transition cursor-pointer"
        >
          <Video size={32} className="mb-3" />
          <h3 className="font-medium text-lg mb-2">Video Tutorials</h3>
          <p className="text-purple-100 text-sm">Watch step-by-step guides</p>
        </a>

        <a
          href={`mailto:${PRODUCT_SUPPORT_EMAIL}`}
          className="bg-green-500 text-white rounded-xl p-6 hover:from-green-600 hover:to-green-700 transition cursor-pointer"
        >
          <Mail size={32} className="mb-3" />
          <h3 className="font-medium text-lg mb-2">Contact Support</h3>
          <p className="text-green-100 text-sm">Get help from our team</p>
        </a>
      </div>

      {/* Help Sections */}
      <div className="space-y-4">
        {filteredSections.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Search className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-xl font-medium text-gray-600 mb-2">No results found</h3>
            <p className="text-gray-500">Try different search terms or browse categories below</p>
          </div>
        ) : (
          filteredSections.map((section) => {
            const SectionIcon = section.icon;
            const isExpanded = expandedSections[section.id];

            return (
              <div key={section.id} id={section.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 bg-${section.color}-100 rounded-lg flex items-center justify-center`}>
                      <SectionIcon className={`text-${section.color}-600`} size={20} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-800">{section.title}</h3>
                    <span className="text-sm text-gray-500">({section.articles.length} articles)</span>
                  </div>
                  {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>

                {isExpanded && (
                  <div className="border-t">
                    {section.articles.map((article, index) => (
                      <div
                        key={index}
                        className="px-6 py-4 border-b last:border-b-0 hover:bg-gray-50 transition"
                      >
                        <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                          <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </span>
                          {article.title}
                        </h4>
                        <p className="text-gray-600 text-sm leading-relaxed pl-8">{article.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Additional Resources */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-3 flex items-center gap-2">
          <HelpCircle size={20} />
          Need More Help?
        </h3>
        <p className="text-blue-700 mb-4">
          Can't find what you're looking for? Our support team is ready to assist you with any questions or issues.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`mailto:${PRODUCT_SUPPORT_EMAIL}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold flex items-center gap-2"
          >
            <Mail size={16} />
            Email Support
          </a>
          <a
            href="tel:0700000000"
            className="px-4 py-2 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition font-semibold flex items-center gap-2"
          >
            <MessageSquare size={16} />
            Call Us
          </a>
        </div>
        <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200">
          <p className="text-sm text-gray-700">
            <strong>Support Hours:</strong> Monday - Friday, 8:00 AM - 5:00 PM EAT<br />
            <strong>Email:</strong> {PRODUCT_SUPPORT_EMAIL}<br />
            <strong>Phone:</strong> 0713 612 141<br />
            <strong>Response Time:</strong> Within 24 hours
          </p>
        </div>
      </div>
    </div>
  );
};

export default SupportHub;
