/* ═══════════════════════════════════════════════════
   BOSCO FERNANDEZ — main.js
   No animation libraries. Nav + mobile menu + video modal only.
═══════════════════════════════════════════════════ */

/* ── NAV scroll solid ──────────────────────────── */
window.addEventListener('scroll', () => {
  document.getElementById('nav').classList.toggle('solid', window.scrollY > 60);
}, { passive: true });

/* ── MOBILE MENU ───────────────────────────────── */
function toggleMenu() {
  document.getElementById('mobile-menu').classList.toggle('open');
}

