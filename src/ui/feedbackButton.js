/**
 * Site-Level Feedback & Bug Report Button Controller
 */

import { getFeedbackUrlForCurrentContext } from '../config/reportIssue.js';

export function initFeedbackButton() {
  const btn = document.getElementById('whmx-feedback-btn');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const url = getFeedbackUrlForCurrentContext();
    window.open(url, '_blank', 'noopener,noreferrer');
  });
}
