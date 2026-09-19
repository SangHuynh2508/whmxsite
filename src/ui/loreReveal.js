/**
 * WHMX Shared Lore Reveal Module — Zero-Flash / Zero-Layout-Shift
 * 
 * ARCHITECTURE:
 * - 3-tier DOM structure:
 *   1. .lore-layout-measure: contains final text, visibility: hidden, flow participant to reserve height
 *   2. .lore-visual-text: absolute overlay containing typing + frontier scrambling text (starts empty)
 *   3. .lore-sr-text: screen-reader accessible final text, aria-live: off
 * - Centralized tuning constants for easy speed adjustment
 * - Left-to-right typing growth with small frontier scramble (1-2 letters)
 * - Letters randomize through Latin + Vietnamese accented alphabet; spaces/punctuation appear instantly
 * - Zero visual flash of final text before reveal
 * - Zero vertical height collapse or line-by-line jumping
 */

// ============================================================================
// CENTRALIZED TIMING CONFIGURATION (TUNABLE BY OWNER)
// ============================================================================
export const LORE_REVEAL_MIN_MS = 1000;    // ~1.0s minimum duration for short lore (<= 30 chars)
export const LORE_REVEAL_MID1_MS = 1200;   // ~1.2s duration for medium-short lore (31-70 chars)
export const LORE_REVEAL_MID2_MS = 1450;   // ~1.45s duration for medium-long lore (71-120 chars)
export const LORE_REVEAL_MAX_MS = 1700;    // ~1.7s cap for very long lore (> 120 chars)
export const SCRAMBLE_REFRESH_MS = 50;     // 50ms interval for scramble character refresh
export const SCRAMBLE_OVERLAP_CHARS = 2;   // active scrambling frontier window size (2 chars)
// Note: Character locking progresses continuously from left to right over the total duration;
// characters within the frontier window cycle random glyphs every 50ms.

// Scramble character set: Latin + Vietnamese accented letters (no geometric symbols)
const SCRAMBLE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzĂÂĐÊÔƠƯăâđêôơư';

/**
 * Segment a string into grapheme clusters.
 * Uses Intl.Segmenter when available, falls back to Array.from.
 */
function segmentGraphemes(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter('vi', { granularity: 'grapheme' });
      return Array.from(segmenter.segment(text), s => s.segment);
    } catch (e) {
      // fallback
    }
  }
  return Array.from(text);
}

/**
 * Returns true if a grapheme is a letter (eligible for scramble).
 * Spaces, punctuation, digits, quotes get instant reveal without scramble.
 */
function isLetterGrapheme(g) {
  if (!g || g.length === 0) return false;
  try {
    return /\p{L}/u.test(g);
  } catch (e) {
    const cp = g.codePointAt(0);
    return (cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A) || cp > 0x7F;
  }
}

function getRandomLetter() {
  return SCRAMBLE_LETTERS[Math.floor(Math.random() * SCRAMBLE_LETTERS.length)];
}

/**
 * Calculate adaptive reveal duration based on grapheme count.
 * Progresses monotonically:
 * <= 30 graphemes: ~1000ms
 * 31–70 graphemes: ~1200ms
 * 71–120 graphemes: ~1450ms
 * > 120 graphemes: scales up to ~1700ms max cap.
 */
function computeAdaptiveDuration(charCount) {
  if (charCount <= 30) return LORE_REVEAL_MIN_MS;
  if (charCount <= 70) return LORE_REVEAL_MID1_MS;
  if (charCount <= 120) return LORE_REVEAL_MID2_MS;
  return Math.min(LORE_REVEAL_MAX_MS, Math.round(LORE_REVEAL_MID2_MS + (charCount - 120) * 4));
}

/**
 * Creates a zero-flash, zero-layout-shift lore reveal controller for a target element.
 * 
 * @param {HTMLElement} element - The DOM element to host the lore reveal
 * @param {Object} [options]
 * @param {number} [options.duration] - Optional override for total reveal duration in ms
 * @returns {{ start: (text: string) => void, cancel: () => void }}
 */
export function createLoreReveal(element, options = {}) {
  let intervalId = null;
  let isRunning = false;
  let graphemes = [];
  let totalGraphemes = 0;
  let finalText = '';
  let startTime = 0;
  let duration = LORE_REVEAL_MIN_MS;

  // Ensure element has relative positioning for absolute visual overlay
  if (window.getComputedStyle(element).position === 'static') {
    element.style.position = 'relative';
  }

  // Find or construct the 3-tier DOM structure
  let measureSpan = element.querySelector('.lore-layout-measure');
  let visualSpan = element.querySelector('.lore-visual-text');
  let srSpan = element.querySelector('.lore-sr-text');

  if (!measureSpan || !visualSpan || !srSpan) {
    element.textContent = '';

    // 1. Layout Measure: hidden participant in document flow to lock container height
    measureSpan = document.createElement('div');
    measureSpan.className = 'lore-layout-measure';
    measureSpan.setAttribute('aria-hidden', 'true');
    measureSpan.style.cssText = 'visibility: hidden !important; pointer-events: none !important; user-select: none !important; line-height: inherit; font-family: inherit; font-size: inherit; font-style: inherit; width: 100%;';

    // 2. Visual Overlay: absolute layer hosting the typing-scramble animation (starts empty)
    visualSpan = document.createElement('div');
    visualSpan.className = 'lore-visual-text';
    visualSpan.setAttribute('aria-hidden', 'true');
    visualSpan.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; line-height: inherit; font-family: inherit; font-size: inherit; font-style: inherit; color: inherit; pointer-events: none;';

    // 3. Screen Reader Text: accessibility carrier
    srSpan = document.createElement('span');
    srSpan.className = 'lore-sr-text';
    srSpan.setAttribute('aria-live', 'off');
    srSpan.style.cssText = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;';

    element.appendChild(measureSpan);
    element.appendChild(visualSpan);
    element.appendChild(srSpan);
  }

  function isReducedMotion() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function stopAnimation() {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  /**
   * Main animation tick (called every SCRAMBLE_REFRESH_MS ms).
   * Progresses targetLocked from 0 to totalGraphemes based on elapsed time.
   */
  function tick() {
    if (!isRunning) return;

    const elapsed = performance.now() - startTime;
    const progress = Math.min(1, elapsed / duration);

    // Compute how many graphemes are fully locked
    let targetLocked = Math.floor(progress * totalGraphemes);

    // Advance past any trailing non-letters (e.g. spaces, commas) immediately
    while (targetLocked < totalGraphemes && !isLetterGrapheme(graphemes[targetLocked])) {
      targetLocked++;
    }

    if (progress >= 1 || targetLocked >= totalGraphemes) {
      visualSpan.textContent = finalText;
      stopAnimation();
      return;
    }

    // Build the visible string:
    // [0 .. targetLocked - 1] => locked real graphemes
    // [targetLocked .. targetLocked + SCRAMBLE_OVERLAP_CHARS - 1] => active scramble frontier
    const frontierEnd = Math.min(targetLocked + SCRAMBLE_OVERLAP_CHARS, totalGraphemes);
    const parts = [];

    for (let i = 0; i < frontierEnd; i++) {
      if (i < targetLocked) {
        // Locked: show real character
        parts.push(graphemes[i]);
      } else {
        // In the scramble frontier:
        // Letters cycle through random characters; non-letters show as-is
        if (isLetterGrapheme(graphemes[i])) {
          parts.push(getRandomLetter());
        } else {
          parts.push(graphemes[i]);
        }
      }
    }

    visualSpan.textContent = parts.join('');
  }

  /**
   * Synchronously starts the reveal for a new lore string.
   * Guarantees:
   * - Immediate height reservation in measureSpan (zero collapse)
   * - VisualSpan starts empty (zero flash of full final text)
   * - Screen reader gets full text synchronously
   */
  function start(text) {
    stopAnimation();
    finalText = text || '';

    // 1. Synchronously reserve final rendered height in measureSpan
    measureSpan.textContent = finalText;

    // 2. Synchronously update accessibility carrier
    srSpan.textContent = finalText;

    // 3. Reduced-motion: show immediately with no scramble
    if (isReducedMotion()) {
      visualSpan.textContent = finalText;
      return;
    }

    if (!finalText) {
      visualSpan.textContent = '';
      return;
    }

    // 4. Segment graphemes and compute duration
    graphemes = segmentGraphemes(finalText);
    totalGraphemes = graphemes.length;
    duration = options.duration || computeAdaptiveDuration(totalGraphemes);

    // 5. Visual starts empty except leading non-letters (such as opening quotation mark “)
    let leadingNonLetters = 0;
    while (leadingNonLetters < totalGraphemes && !isLetterGrapheme(graphemes[leadingNonLetters])) {
      leadingNonLetters++;
    }
    visualSpan.textContent = graphemes.slice(0, leadingNonLetters).join('');

    // 6. Launch interval loop
    isRunning = true;
    startTime = performance.now();
    intervalId = setInterval(tick, SCRAMBLE_REFRESH_MS);
  }

  /**
   * Cancels in-progress animation and immediately snaps to the final text.
   */
  function cancel() {
    stopAnimation();
    if (finalText) {
      measureSpan.textContent = finalText;
      visualSpan.textContent = finalText;
      srSpan.textContent = finalText;
    } else {
      measureSpan.textContent = '';
      visualSpan.textContent = '';
      srSpan.textContent = '';
    }
  }

  return { start, cancel };
}
