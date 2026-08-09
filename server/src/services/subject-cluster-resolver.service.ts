/**
 * subject-cluster-resolver.service.ts
 *
 * Resolves a CBC junior-school subject name to a pathway cluster
 * (STEM | SOCIAL | ARTS) using a two-layer strategy:
 *
 *   Layer 1 — Static keyword map (no DB hit, covers official names + common
 *             variants seen in Kenyan school systems).
 *
 *   Layer 2 — LearningAreaAlias table lookup.  The alias table stores
 *             non-standard names entered by individual schools
 *             (e.g. "Creative Activities", "CRE", "Agri-Science").
 *             OfficialLearningArea.officialCode is mapped to a cluster via
 *             the same static map used for Layer 1.
 *
 * Aliases are loaded once per service lifetime and cached.  The cache can be
 * cleared at runtime (e.g. after an admin seeds new aliases) by calling
 * clearAliasCache().
 *
 * Usage:
 *   import { resolveSubjectCluster } from './subject-cluster-resolver.service';
 *   const cluster = await resolveSubjectCluster('CRE');  // → 'SOCIAL'
 */

import prisma from '../config/database';

// ─── Pathway cluster type ─────────────────────────────────────────────────────

export type PathwayCluster = 'STEM' | 'SOCIAL' | 'ARTS';

// ─── Layer 1 — Static keyword map ────────────────────────────────────────────
//
// Keys are lowercase.  The resolver normalises input before lookup.
// Entries cover:
//   • Official CBC Junior School learning area names
//   • Common abbreviations used by schools
//   • Swahili subject names
//   • Legacy 8-4-4 names still in use during the transition period
//   • Compound names with different separators (& vs and, – vs -)

const STATIC_CLUSTER_MAP: Record<string, PathwayCluster> = {

  // ── STEM ───────────────────────────────────────────────────────────────────
  'mathematics':                             'STEM',
  'math':                                    'STEM',
  'maths':                                   'STEM',
  'integrated science':                      'STEM',
  'science':                                 'STEM',
  'science and technology':                  'STEM',
  'science & technology':                    'STEM',
  'pre-technical studies':                   'STEM',
  'pre technical studies':                   'STEM',
  'pre-technical':                           'STEM',
  'pre technical':                           'STEM',
  'technical studies':                       'STEM',
  'technical':                               'STEM',
  'agriculture':                             'STEM',
  'agri':                                    'STEM',
  'agricultural science':                    'STEM',
  'agri-science':                            'STEM',
  'agri science':                            'STEM',
  'computer science':                        'STEM',
  'computer studies':                        'STEM',
  'computers':                               'STEM',
  'ict':                                     'STEM',
  'information and communication technology':'STEM',
  'information communications technology':   'STEM',
  'information technology':                  'STEM',
  'it':                                      'STEM',
  'home science':                            'STEM',
  'home sciences':                           'STEM',
  'home management':                         'STEM',
  'foods and nutrition':                     'STEM',
  'foods & nutrition':                       'STEM',
  'business studies':                        'STEM',    // treated as applied STEM in junior level

  // ── SOCIAL ────────────────────────────────────────────────────────────────
  'english':                                 'SOCIAL',
  'english language':                        'SOCIAL',
  'kiswahili':                               'SOCIAL',
  'swahili':                                 'SOCIAL',
  'social studies':                          'SOCIAL',
  'social science':                          'SOCIAL',
  'social sciences':                         'SOCIAL',
  'history':                                 'SOCIAL',
  'history and citizenship':                 'SOCIAL',
  'history & citizenship':                   'SOCIAL',
  'geography':                               'SOCIAL',
  'religious education':                     'SOCIAL',
  're':                                      'SOCIAL',
  'cre':                                     'SOCIAL',
  'christian religious education':           'SOCIAL',
  'christian re':                            'SOCIAL',
  'ire':                                     'SOCIAL',
  'islamic religious education':             'SOCIAL',
  'hre':                                     'SOCIAL',
  'hindu religious education':               'SOCIAL',
  'life skills':                             'SOCIAL',
  'life skills education':                   'SOCIAL',
  'indigenous language':                     'SOCIAL',
  'indigenous languages':                    'SOCIAL',
  'mother tongue':                           'SOCIAL',
  'community service learning':              'SOCIAL',
  'csl':                                     'SOCIAL',

  // ── ARTS ─────────────────────────────────────────────────────────────────
  'creative arts and sports':               'ARTS',
  'creative arts & sports':                 'ARTS',
  'creative arts':                          'ARTS',
  'creative activities':                    'ARTS',
  'arts and sports science':                'ARTS',
  'arts & sports science':                  'ARTS',
  'arts and sports':                        'ARTS',
  'arts & sports':                          'ARTS',
  'ca':                                     'ARTS',
  'cas':                                    'ARTS',
  'music':                                  'ARTS',
  'music and dance':                        'ARTS',
  'music & dance':                          'ARTS',
  'dance':                                  'ARTS',
  'drama':                                  'ARTS',
  'theatre':                                'ARTS',
  'theatre and film':                       'ARTS',
  'performing arts':                        'ARTS',
  'fine arts':                              'ARTS',
  'fine art':                               'ARTS',
  'art':                                    'ARTS',
  'visual arts':                            'ARTS',
  'physical education':                     'ARTS',
  'pe':                                     'ARTS',
  'physical education and games':           'ARTS',
  'games':                                  'ARTS',
  'sports':                                 'ARTS',
  'sports and recreation':                  'ARTS',
  'sport':                                  'ARTS',
};

// Map official learning area codes → cluster.
// These are the codes used in OfficialLearningArea.officialCode.
const OFFICIAL_CODE_CLUSTER_MAP: Record<string, PathwayCluster> = {
  // STEM
  'CORE_MATH': 'STEM', 'ESS_MATH': 'STEM', 'ADV_MATH': 'STEM',
  'BIO': 'STEM', 'CHEM': 'STEM', 'PHY': 'STEM', 'GEN_SCI': 'STEM',
  'AGRI': 'STEM', 'COMP_STUD': 'STEM', 'HOME_SCI': 'STEM',
  'AVIATION': 'STEM', 'BUILDING_CONSTRUCTION': 'STEM',
  'ELECTRICITY': 'STEM', 'METALWORK': 'STEM', 'POWER_MECHANICS': 'STEM',
  'WOODWORK': 'STEM', 'MEDIA_TECH': 'STEM', 'MARINE_FISHERIES': 'STEM',
  // SOCIAL
  'ENG': 'SOCIAL', 'KIS': 'SOCIAL', 'KSL': 'SOCIAL', 'CSL': 'SOCIAL',
  'IND_LANG': 'SOCIAL', 'FASIHI': 'SOCIAL', 'ARABIC': 'SOCIAL',
  'FRENCH': 'SOCIAL', 'GERMAN': 'SOCIAL', 'MANDARIN': 'SOCIAL',
  'CRE': 'SOCIAL', 'IRE': 'SOCIAL', 'HRE': 'SOCIAL',
  'BUSINESS': 'SOCIAL', 'HISTORY_CIT': 'SOCIAL', 'GEOGRAPHY': 'SOCIAL',
  'LIT_ENG': 'SOCIAL',
  // ARTS
  'PE': 'ARTS', 'FINE_ARTS': 'ARTS', 'MUSIC_DANCE': 'ARTS',
  'THEATRE_FILM': 'ARTS', 'SPORTS_RECREATION': 'ARTS',
};

// ─── Alias cache ──────────────────────────────────────────────────────────────

// alias (lowercase, trimmed) → cluster
let aliasCache: Map<string, PathwayCluster> | null = null;
let cacheLoadedAt: number | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Force the next call to re-load aliases from the database. */
export function clearAliasCache(): void {
  aliasCache = null;
  cacheLoadedAt = null;
}

async function loadAliasCache(): Promise<Map<string, PathwayCluster>> {
  const now = Date.now();
  if (aliasCache && cacheLoadedAt && now - cacheLoadedAt < CACHE_TTL_MS) {
    return aliasCache;
  }

  const aliases = await prisma.learningAreaAlias.findMany({
    where: { active: true },
    select: {
      alias: true,
      officialLearningArea: { select: { officialCode: true } },
    },
  });

  const map = new Map<string, PathwayCluster>();
  for (const row of aliases) {
    const cluster = OFFICIAL_CODE_CLUSTER_MAP[row.officialLearningArea.officialCode];
    if (cluster) {
      map.set(row.alias.toLowerCase().trim(), cluster);
    }
  }

  aliasCache = map;
  cacheLoadedAt = now;
  return map;
}

// ─── Public resolver ─────────────────────────────────────────────────────────

/**
 * Resolves a subject name to a pathway cluster.
 *
 * Returns null when no match is found in either the static map or the
 * alias table — the caller should treat null as "unclassified" and skip
 * the score for that subject rather than silently scoring zero.
 */
export async function resolveSubjectCluster(
  subjectName: string,
): Promise<PathwayCluster | null> {
  const normalised = subjectName.toLowerCase().trim()
    // Collapse multiple spaces / hyphens / ampersands
    .replace(/\s+/g, ' ')
    .replace(/&/g, 'and')
    .replace(/-/g, ' ');

  // Layer 1 — exact static match
  if (STATIC_CLUSTER_MAP[normalised]) return STATIC_CLUSTER_MAP[normalised];

  // Layer 1b — partial static match (substring both ways)
  for (const [key, cluster] of Object.entries(STATIC_CLUSTER_MAP)) {
    if (normalised.includes(key) || key.includes(normalised)) return cluster;
  }

  // Layer 2 — alias table lookup
  const cache = await loadAliasCache();
  if (cache.has(normalised)) return cache.get(normalised)!;

  // Layer 2b — partial alias match
  for (const [alias, cluster] of cache.entries()) {
    if (normalised.includes(alias) || alias.includes(normalised)) return cluster;
  }

  return null;
}

/**
 * Synchronous version — uses only the static map.
 * Use when a DB call is not acceptable (e.g. inside a tight loop that
 * has already pre-loaded results).  Falls back to the async version
 * when the caller awaits the full resolver above.
 */
export function resolveSubjectClusterSync(subjectName: string): PathwayCluster | null {
  const normalised = subjectName.toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/&/g, 'and')
    .replace(/-/g, ' ');

  if (STATIC_CLUSTER_MAP[normalised]) return STATIC_CLUSTER_MAP[normalised];

  for (const [key, cluster] of Object.entries(STATIC_CLUSTER_MAP)) {
    if (normalised.includes(key) || key.includes(normalised)) return cluster;
  }
  return null;
}

/**
 * Batch resolver — resolves a list of subject names in a single DB call.
 * Returns a Map<subjectName, cluster | null>.
 */
export async function resolveSubjectClusters(
  subjectNames: string[],
): Promise<Map<string, PathwayCluster | null>> {
  const cache = await loadAliasCache();
  const result = new Map<string, PathwayCluster | null>();

  for (const name of subjectNames) {
    const normalised = name.toLowerCase().trim()
      .replace(/\s+/g, ' ')
      .replace(/&/g, 'and')
      .replace(/-/g, ' ');

    // Layer 1 exact
    if (STATIC_CLUSTER_MAP[normalised]) { result.set(name, STATIC_CLUSTER_MAP[normalised]); continue; }

    // Layer 1 partial
    let found: PathwayCluster | null = null;
    for (const [key, cluster] of Object.entries(STATIC_CLUSTER_MAP)) {
      if (normalised.includes(key) || key.includes(normalised)) { found = cluster; break; }
    }
    if (found) { result.set(name, found); continue; }

    // Layer 2 exact alias
    if (cache.has(normalised)) { result.set(name, cache.get(normalised)!); continue; }

    // Layer 2 partial alias
    for (const [alias, cluster] of cache.entries()) {
      if (normalised.includes(alias) || alias.includes(normalised)) { found = cluster; break; }
    }
    result.set(name, found);
  }

  return result;
}
