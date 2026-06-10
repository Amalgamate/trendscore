/**
 * Communication Messages Configuration (Backend)
 * Centralized management of all SMS, Email, and notification templates
 * used across the backend services
 */

import {
  PRODUCT_APP_URL,
  PRODUCT_BRAND_EMAIL,
  PRODUCT_DISPLAY_NAME,
  PRODUCT_LOGO_URL,
  PRODUCT_NO_REPLY_EMAIL,
  PRODUCT_WEBSITE,
} from './productIdentity';

export const COMMUNICATION_CONFIG = {
  // Email Provider Defaults
  email: {
    fromEmail: PRODUCT_NO_REPLY_EMAIL,
    fromName: process.env.EMAIL_FROM_NAME || PRODUCT_DISPLAY_NAME,
    provider: process.env.EMAIL_PROVIDER || 'resend'
  },

  // SMS Provider Defaults
  sms: {
    provider: process.env.SMS_PROVIDER || 'mobilesasa',
    baseUrl: process.env.SMS_BASE_URL || 'https://api.mobilesasa.com',
    defaultSenderId: process.env.SMS_SENDER_ID || 'MOBILESASA'
  },

  // Frontend Configuration
  frontend: {
    url: process.env.FRONTEND_URL || PRODUCT_APP_URL
  }
};

// SMS Message Templates
export const SMS_MESSAGES = {
  welcome: (schoolName: string): string =>
    `Welcome to ${PRODUCT_DISPLAY_NAME}! Your school ${schoolName} is set up. Log in to your dashboard to get started.`,

  assessmentReportHeader: (schoolName: string): string =>
    `FROM ${schoolName}`,

  assessmentReportGreeting: (parentName?: string): string =>
    parentName ? `Dear ${parentName}` : 'Dear Parent',

  assessmentReport: (data: {
    schoolName: string;
    parentName?: string;
    learnerName: string;
    learnerGrade: string;
    term: string;
    assessmentType?: string;
    overallGrade?: string;
    averageScore?: string;
    totalMarks?: number;
    maxPossibleMarks?: number;
  }): string => {
    const {
      schoolName,
      parentName,
      learnerName,
      learnerGrade,
      term,
      assessmentType = 'Term Assessment',
      overallGrade = 'N/A',
      averageScore = '0',
      totalMarks = 0,
      maxPossibleMarks = 0
    } = data;

    const greeting = parentName ? `Dear ${parentName}` : 'Dear Parent';

    return (
      `FROM ${schoolName}\n\n` +
      `${greeting},\n\n` +
      `${assessmentType}, ${term}, ${new Date().getFullYear()}\n\n` +
      `NAME: ${learnerName}\n` +
      `GRADE: ${learnerGrade}\n\n` +
      `GRADE: ${overallGrade}\n` +
      `MEAN MARKS: ${averageScore}%\n` +
      `TOTAL MARKS: ${totalMarks} / ${maxPossibleMarks}`
    );
  },

  otp: (otpCode: string, expiryMinutes: number = 10): string =>
    `Your ${PRODUCT_DISPLAY_NAME} login OTP is: ${otpCode}. Valid for ${expiryMinutes} minutes. Do not share this code.`,

  birthdayStandard: (learnerName: string, schoolName: string, gradeName: string): string =>
    `Happy Birthday ${learnerName}! Best wishes from ${schoolName}. We are proud of your progress in ${gradeName}. Have a wonderful day!`,

  birthdayPremium: (data: {
    learnerName: string;
    schoolName: string;
    gradeName: string;
    ageOrdinal: string;
    bdayDate: string;
  }): string => {
    const { learnerName, schoolName, gradeName, ageOrdinal, bdayDate } = data;
    return (
      `*Happy Birthday ${learnerName}!* 🎉🎈\n\n` +
      `${schoolName} is thrilled to celebrate you on your *${ageOrdinal} birthday* today, ${bdayDate}! 🎊\n\n` +
      `We are so proud of your progress in *${gradeName}*. May your day be filled with joy, laughter, and wonderful memories. Keep shining bright! ✨\n\n` +
      `Best wishes,\n*The ${schoolName} Family*`
    );
  },

  enrollment: (data: {
    schoolName: string;
    parentName?: string;
    learnerName: string;
    learnerGrade: string;
    admissionNumber: string;
  }): string => {
    const { schoolName, parentName, learnerName, learnerGrade, admissionNumber } = data;
    const greeting = parentName ? `Hello ${parentName.split(' ')[0]}` : 'Hello';

    return (
      `${greeting},\n\n` +
      `Welcome to ${schoolName}!\n\n` +
      `Student: ${learnerName}\n` +
      `Grade: ${learnerGrade}\n` +
      `Admission No: ${admissionNumber}\n\n` +
      `We are excited to have ${learnerName} join our learning community. ` +
      `Your parent portal is ready. Please log in to track progress and school updates.\n\n` +
      `Best regards,\n${schoolName}`
    );
  },

  passwordReset: (password: string, schoolName: string): string =>
    `Your password for ${schoolName} has been reset by the administrator. Your new password is: ${password}. For security, please log in and change it immediately.`
};

// Email Message Templates
export const EMAIL_MESSAGES = {
  welcome: {
    welcome: {
      subject: (schoolName: string): string => `Welcome to ${schoolName} on ${PRODUCT_DISPLAY_NAME}!`,
      preheader: 'Your school is set up and ready to go',
      headingText: `Welcome to ${PRODUCT_DISPLAY_NAME}!`,
      mainText: (schoolName: string): string =>
        `Congratulations! Your school, <strong>${schoolName}</strong>, has been successfully registered on ${PRODUCT_DISPLAY_NAME}.`
    },

    onboarding: {
      subject: `Get Started with ${PRODUCT_DISPLAY_NAME}`,
      preheader: 'Your onboarding guide is here',
      headingText: 'Welcome Aboard!',
      mainText: (schoolName: string): string =>
        `Here's everything you need to know to get started with ${PRODUCT_DISPLAY_NAME} at ${schoolName}.`
    },

    footer: (schoolName: string, year: number): string =>
      `&copy; ${year} ${schoolName} via ${PRODUCT_DISPLAY_NAME}. All rights reserved.<br/>You received this email because you signed up for a ${PRODUCT_DISPLAY_NAME} account.`
  }
};

// Learning Area Abbreviations for SMS
export const LEARNING_AREA_ABBREVIATIONS: Record<string, string> = {
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

// Error Messages
export const ERROR_MESSAGES = {
  sms: {
    notConfigured: 'SMS not configured for this school',
    disabled: 'SMS is disabled for this school',
    invalidPhone: 'Invalid phone number',
    failedToSend: 'Failed to send SMS',
    missingParameters: 'Missing required parameters'
  },

  email: {
    notConfigured: 'Email not configured for this school',
    disabled: 'Email is disabled for this school',
    invalidEmail: 'Invalid email address',
    failedToSend: 'Failed to send email',
    missingParameters: 'Missing required parameters'
  },

  communication: {
    schoolContextRequired: 'School context required',
    missingRequiredFields: 'Missing required fields',
    configurationError: 'Configuration error'
  }
};

// Success Messages
export const SUCCESS_MESSAGES = {
  sms: {
    sent: 'SMS sent successfully',
    testSent: 'Test SMS sent successfully'
  },

  email: {
    sent: 'Email sent successfully',
    testSent: 'Test email sent successfully'
  },

  communication: {
    configSaved: 'Communication configuration saved successfully',
    testComplete: 'Test completed successfully'
  }
};

// Brand Information
export const BRAND = {
  name: PRODUCT_DISPLAY_NAME,
  email: PRODUCT_BRAND_EMAIL,
  phone: process.env.BRAND_PHONE || '+254700000000',
  website: PRODUCT_WEBSITE,
  logo: PRODUCT_LOGO_URL,
  displayName: PRODUCT_DISPLAY_NAME,
  tagline: 'Advanced School Management System'
};

// OTP Configuration
export const OTP_CONFIG = {
  expiryMinutes: 10,
  maxAttempts: 5,
  cooldownMinutes: 15
};

// Message Channel Configuration
export const MESSAGE_CHANNELS = {
  SMS: 'SMS',
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
  IN_APP: 'IN_APP'
} as const;

// Assessment Template Types
export const ASSESSMENT_TEMPLATE_TYPES = {
  FORMATIVE_EXCEEDING: 'FORMATIVE_EXCEEDING',
  FORMATIVE_ACHIEVING: 'FORMATIVE_ACHIEVING',
  FORMATIVE_DEVELOPING: 'FORMATIVE_DEVELOPING',
  SUMMATIVE_TERM: 'SUMMATIVE_TERM',
  ALERT_CRITICAL: 'ALERT_CRITICAL',
  ALERT_IMPROVEMENT: 'ALERT_IMPROVEMENT'
} as const;
