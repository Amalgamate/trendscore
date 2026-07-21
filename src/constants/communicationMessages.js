/**
 * Communication Messages Configuration
 * Centralized management of all messages, templates, and default values
 * used across the communication module
 */

import {
  PRODUCT_BRAND_EMAIL,
  PRODUCT_DISPLAY_NAME,
  PRODUCT_LOGO_URL,
  PRODUCT_NO_REPLY_EMAIL,
  PRODUCT_WEBSITE,
} from '../config/productIdentity';

export const COMMUNICATION_DEFAULTS = {
  // Email Defaults
  email: {
    provider: 'resend',
    fromEmail: import.meta.env.VITE_EMAIL_FROM || PRODUCT_NO_REPLY_EMAIL,
    fromName: import.meta.env.VITE_EMAIL_FROM_NAME || PRODUCT_DISPLAY_NAME,
    enabled: false
  },

  // SMS Defaults
  sms: {
    provider: 'africastalking',
    baseUrl: 'https://api.africastalking.com/version1/messaging',
    apiKey: import.meta.env.VITE_SMS_API_KEY || '',
    username: import.meta.env.VITE_SMS_USERNAME || '',
    senderId: import.meta.env.VITE_SMS_SENDER_ID || '',
    enabled: false
  },

  // M-Pesa Defaults
  mpesa: {
    provider: 'интасенд',
    enabled: false
  }
};

export const SMS_PROVIDER_BASE_URLS = {
  africastalking: 'https://api.africastalking.com/version1/messaging',
  mobilesasa: 'https://api.mobilesasa.com'
};

export const TEST_MESSAGES = {
  sms: import.meta.env.VITE_TEST_SMS_MESSAGE || `This is a test message from ${PRODUCT_DISPLAY_NAME}.`,
  email: {
    welcome: {
      subject: `Welcome to ${PRODUCT_DISPLAY_NAME}`,
      preview: 'Welcome email template'
    },
    onboarding: {
      subject: 'Onboarding Guide',
      preview: 'Onboarding email template'
    }
  }
};

export const SMS_MESSAGES = {
  welcome: (schoolName) => `Welcome to ${PRODUCT_DISPLAY_NAME}! Your school ${schoolName} is set up. Log in to your dashboard to get started.`,

  assessmentReport: {
    header: (schoolName) => `FROM ${schoolName}`,
    greeting: (parentName) => parentName ? `Dear ${parentName}` : 'Dear Parent',
    structure: (schoolName, parentName, learnerName, learnerGrade, term, overallGrade, averageScore, totalMarks, maxPossibleMarks, assessmentType) => (`
${`FROM ${schoolName}`}

${parentName ? `Dear ${parentName}` : 'Dear Parent'},

${assessmentType || 'Assessment'}, ${term}, ${new Date().getFullYear()}

NAME: ${learnerName}
GRADE: ${learnerGrade}

GRADE: ${overallGrade || 'N/A'}
MEAN MARKS: ${averageScore || '0'}%
TOTAL MARKS: ${totalMarks || 0} / ${maxPossibleMarks || 0}`)
  },

  otp: (otpCode, expiryMinutes = 10) =>
    `Your ${PRODUCT_DISPLAY_NAME} login OTP is: ${otpCode}. Valid for ${expiryMinutes} minutes. Do not share this code.`,

  birthday: {
    standard: (learnerName, schoolName, gradeName, ageOrdinal, bdayDate) =>
      `Happy Birthday ${learnerName}! Best wishes from ${schoolName}. We are proud of your progress in ${gradeName}. Have a wonderful day!`,
    premium: (learnerName, schoolName, gradeName, ageOrdinal, bdayDate) =>
      `*Happy Birthday ${learnerName}!* 🎉🎈\n\n${schoolName} is thrilled to celebrate you on your *${ageOrdinal} birthday* today, ${bdayDate}! 🎊\n\nWe are so proud of your progress in *${gradeName}*. May your day be filled with joy, laughter, and wonderful memories. Keep shining bright! ✨\n\nBest wishes,\n*The ${schoolName} Family*`
  }
};

export const EMAIL_TEMPLATES = {
  welcome: {
    subject: `Welcome to ${PRODUCT_DISPLAY_NAME}!`,
    preheader: 'Your school is set up and ready to go'
  },
  onboarding: {
    subject: `Get Started with ${PRODUCT_DISPLAY_NAME}`,
    preheader: 'Your onboarding guide is here'
  },
  assessmentReport: {
    subject: (schoolName) => `${schoolName} - Assessment Report`,
    preheader: 'Your child\'s assessment results'
  }
};

export const LEARNING_AREA_ABBREVIATIONS = {
  'MATHEMATICS': 'MAT',
  'ENGLISH': 'ENG',
  'KISWAHILI': 'KIS',
  'SCIENCE AND TECHNOLOGY': 'SCITECH',
  'SOCIAL STUDIES': 'SST',
  'CHRISTIAN RELIGIOUS EDUCATION': 'CRE',
  'ISLAMIC RELIGIOUS EDUCATION': 'IRE',
  'CREATIVE ARTS AND SPORTS': 'CREATIVE',
  'AGRICULTURE': 'AGRI',
  'ENVIRONMENTAL ACTIVITIES': 'ENV',
  'MATHEMATICAL ACTIVITIES': 'MAT',
  'ENGLISH LANGUAGE ACTIVITIES': 'ENG',
  'KISWAHILI LANGUAGE ACTIVITIES': 'KIS'
};

export const ERROR_MESSAGES = {
  sms: {
    notConfigured: 'SMS is not configured for this school',
    disabled: 'SMS is disabled for this school',
    invalidPhone: 'Enter valid phone number (format: 254...)',
    failedToSend: 'Failed to send SMS'
  },
  email: {
    notConfigured: 'Email is not configured for this school',
    disabled: 'Email is disabled for this school',
    invalidEmail: 'Enter valid email address',
    failedToSend: 'Failed to send email'
  },
  general: {
    missingContext: 'School context missing',
    requiredFields: 'Missing required fields'
  }
};

export const SUCCESS_MESSAGES = {
  sms: {
    sent: 'SMS sent successfully!',
    testSent: 'Test SMS sent successfully!'
  },
  email: {
    sent: 'Email sent successfully!',
    testSent: 'Test email sent successfully!'
  }
};

// Brand/Organization Info
export const BRAND = {
  name: PRODUCT_DISPLAY_NAME,
  email: import.meta.env.VITE_BRAND_EMAIL || PRODUCT_BRAND_EMAIL,
  phone: import.meta.env.VITE_BRAND_PHONE || '+254 712 345 678',
  website: import.meta.env.VITE_BRAND_WEBSITE || PRODUCT_WEBSITE,
  logo: import.meta.env.VITE_BRAND_LOGO || PRODUCT_LOGO_URL,
  displayName: PRODUCT_DISPLAY_NAME,
  tagline: 'Advanced School Management System'
};
