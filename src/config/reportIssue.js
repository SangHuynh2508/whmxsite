/**
 * Google Form Feedback & Bug Report Configuration
 * Centralized mapping for the public Google Form.
 */

import { parseHash, getCharBySlugOrId } from '../app/router/router.js';

export const FEEDBACK_FORM_CONFIG = {
  canonicalBaseUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSe2aGBWSRMvVwpX5-UHDIYVry-lpbMBomQEbjMC997eotMtfA/viewform',
  publicUrl: 'https://forms.gle/awj4P7Z5TdnrFyXN9',
  entries: {
    type: 'entry.1533198529',          // Feedback type (e.g. "Báo lỗi", "Góp ý", "Đề xuất tính năng")
    characterId: 'entry.1660529958',   // Character ID (e.g. "D0183")
    characterName: 'entry.618311652',  // Character name (e.g. "Huyễn Hý Đồ")
    route: 'entry.1322857427',          // Current route / section label (e.g. "Tổng Quan")
    pageUrl: 'entry.1220831771'        // Current page URL (window.location.href)
  }
};

/**
 * Maps character detail subtabs to standard Vietnamese labels.
 */
export const SUBTAB_ROUTE_LABELS = {
  overview: 'Tổng Quan',
  info: 'Thông Tin',
  skills: 'Thông Tin',
  talents: 'Thiên Phú',
  build: 'Build',
  gallery: 'Thư Viện'
};

/**
 * Maps high-level views to standard Vietnamese labels outside character detail.
 */
export const VIEW_ROUTE_LABELS = {
  catalog: 'Khí Giả',
  gallery: 'Thư Viện Trang Phục',
  data: 'Dữ Liệu',
  calculator: 'Máy Tính',
  'skin-detail': 'Chi Tiết Y Phục'
};

/**
 * Builds the prefilled Google Form URL.
 * Automatically omits null, undefined, or empty string values.
 * Uses native URL and URLSearchParams.
 *
 * @param {Object} options
 * @param {string} [options.type] - Feedback type (leave empty for generic button)
 * @param {string} [options.characterId] - Character ID (omitted on non-character pages)
 * @param {string} [options.characterName] - Character name (omitted on non-character pages)
 * @param {string} [options.route] - Current route or section label
 * @param {string} [options.pageUrl] - Current page URL (defaults to window.location.href if browser)
 * @returns {string} Fully constructed URL
 */
export function buildFeedbackFormUrl({
  type,
  characterId,
  characterName,
  route,
  pageUrl
} = {}) {
  const url = new URL(FEEDBACK_FORM_CONFIG.canonicalBaseUrl);
  const params = url.searchParams;

  // Standard Google Forms prefill indicator
  params.set('usp', 'pp_url');

  const setIfValid = (entryKey, value) => {
    if (value !== null && value !== undefined && typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        params.set(entryKey, trimmed);
      }
    }
  };

  setIfValid(FEEDBACK_FORM_CONFIG.entries.type, type);
  setIfValid(FEEDBACK_FORM_CONFIG.entries.characterId, characterId);
  setIfValid(FEEDBACK_FORM_CONFIG.entries.characterName, characterName);
  setIfValid(FEEDBACK_FORM_CONFIG.entries.route, route);

  const finalPageUrl = pageUrl ?? (typeof window !== 'undefined' ? window.location.href : '');
  setIfValid(FEEDBACK_FORM_CONFIG.entries.pageUrl, finalPageUrl);

  return url.toString();
}

/**
 * Evaluates the current runtime application context and produces the appropriate
 * feedback URL. Evaluated at invocation time to avoid caching stale state.
 *
 * @param {Object} [options]
 * @param {string} [options.type] - Optional explicit feedback type (defaults to undefined for generic button)
 * @returns {string} Formatted Google Form URL
 */
export function getFeedbackUrlForCurrentContext({ type } = {}) {
  const route = parseHash();

  if (route.view === 'character') {
    const char = getCharBySlugOrId(route.slug);
    const subtabKey = (route.subtab || 'overview').toLowerCase();
    const routeLabel = SUBTAB_ROUTE_LABELS[subtabKey] || 'Tổng Quan';

    return buildFeedbackFormUrl({
      type,
      characterId: char?.id || undefined,
      characterName: (char?.name_vi || char?.name_cn) || undefined,
      route: routeLabel,
      pageUrl: typeof window !== 'undefined' ? window.location.href : undefined
    });
  }

  // Non-character pages: omit characterId and characterName
  const viewLabel = VIEW_ROUTE_LABELS[route.view] || undefined;
  return buildFeedbackFormUrl({
    type,
    characterId: undefined,
    characterName: undefined,
    route: viewLabel,
    pageUrl: typeof window !== 'undefined' ? window.location.href : undefined
  });
}
