import { useCallback, useEffect, useState } from 'react';

/**
 * Parent Portal i18n — Swahili / English label dictionary
 *
 * Lightweight, localStorage-backed language preference for parent-facing labels.
 * Not a full i18n framework — just the most visible navigation and action labels
 * that Kenyan parents interact with on every screen.
 *
 * Usage:
 *   import { t, useParentLang } from './parent-i18n';
 *   const { lang, setLang, t } = useParentLang();
 *   <p>{t('fees')}</p>  // "Fees" (en) or "Ada" (sw)
 */

const STORAGE_KEY = 'trendscore:parent_lang';

export const LANGS = { en: 'English', sw: 'Kiswahili' };

export const DICTIONARY = {
  // Navigation tabs
  home:        { en: 'Home',        sw: 'Nyumbani' },
  children:    { en: 'Children',    sw: 'Watoto' },
  fees:        { en: 'Fees',        sw: 'Ada' },
  inbox:       { en: 'Inbox',       sw: 'Ujumbe' },
  more:        { en: 'More',        sw: 'Zaidi' },

  // Actions
  pay:         { en: 'Pay',         sw: 'Lipa' },
  view:        { en: 'View',        sw: 'Tazama' },
  cancel:      { en: 'Cancel',      sw: 'Ghairi' },
  save:        { en: 'Save',        sw: 'Hifadhi' },
  send:        { en: 'Send',        sw: 'Tuma' },
  download:    { en: 'Download',    sw: 'Pakua' },
  edit:        { en: 'Edit',        sw: 'Hariri' },
  logout:      { en: 'Logout',      sw: 'Toka' },

  // Labels
  balance:     { en: 'Balance',     sw: 'Salio' },
  attendance:  { en: 'Attendance',  sw: 'Mahudhurio' },
  results:     { en: 'Results',     sw: 'Matokeo' },
  messages:    { en: 'Messages',    sw: 'Ujumbe' },
  homework:    { en: 'Homework',    sw: 'Kazi za Nyumbani' },
  today:       { en: 'Today',       sw: 'Leo' },
  settings:    { en: 'Settings',    sw: 'Mipangilio' },
  profile:     { en: 'Profile',     sw: 'Wasifu' },
  transport:   { en: 'Transport',   sw: 'Usafiri' },
  documents:   { en: 'Documents',   sw: 'Nyaraka' },
  support:     { en: 'Support',     sw: 'Msaada' },
  pathway:     { en: 'Pathway',     sw: 'Njia ya Kazi' },
  schools:     { en: 'Schools',     sw: 'Shule' },
  boarding:    { en: 'Boarding',    sw: 'Bodi' },
  present:     { en: 'Present',     sw: 'Aliko' },
  absent:      { en: 'Absent',      sw: 'Hakukuwa' },
  cleared:     { en: 'Cleared',     sw: 'Imelipwa' },
  outstanding: { en: 'Outstanding', sw: 'Haijalipwa' },
  termAvg:     { en: 'Term average', sw: 'Wastani wa Muhula' },
  academicYear:{ en: 'Academic Year', sw: 'Mwaka wa Masomo' },
  subjects:    { en: 'Subjects',    sw: 'Masomo' },
  reportCards: { en: 'Report Cards', sw: 'Ripoti za Masomo' },
  quickPay:    { en: 'Pay with M-Pesa', sw: 'Lipa kwa M-Pesa' },
  advancedOptions: { en: 'Advanced options', sw: 'Chaguo za Juu' },
};

export function getLang() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'en';
  } catch (_) {
    return 'en';
  }
}

export function setLang(lang) {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
}

export function translate(key, lang = getLang()) {
  const entry = DICTIONARY[key];
  if (!entry) return key;
  return entry[lang] || entry.en || key;
}

/**
 * React hook for parent portal language.
 * Returns { lang, setLang, t } — t is a function that translates a key.
 */
export function useParentLang() {
  const [lang, setLangState] = useState(getLang());

  const setLangCb = useCallback((newLang) => {
    setLang(newLang);
    setLangState(newLang);
    // Dispatch event so other components can react
    window.dispatchEvent(new CustomEvent('trendscore:lang-change', { detail: newLang }));
  }, []);

  useEffect(() => {
    const syncLang = (event) => setLangState(event.detail || getLang());
    window.addEventListener('trendscore:lang-change', syncLang);
    return () => window.removeEventListener('trendscore:lang-change', syncLang);
  }, []);

  const t = useCallback((key) => translate(key, lang), [lang]);

  return { lang, setLang: setLangCb, t };
}
