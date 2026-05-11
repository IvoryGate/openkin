/**
 * toast-system.js — Toast notification system
 *
 * Extracted from app.js to reduce file size.
 * This is a plain script (not module), loaded before app.js via index.html.
 * Exposes showToast and dismissToast to window.
 * Dependencies: escapeHtml (from window, set by app.js).
 */

const toastContainerEl = document.getElementById("toast-container")
const TOAST_AUTO_DISMISS_MS = 5000

function _escapeHtmlForToast(raw) {
  // Use window.escapeHtml if available (set by app.js), otherwise inline fallback
  if (typeof window.escapeHtml === "function") return window.escapeHtml(raw)
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function _svgIconForToast(name) {
  // Use window.svgIcon if available, otherwise inline fallback
  if (typeof window.svgIcon === "function") return window.svgIcon(name)
  const icons = {
    success: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M24 44c11 0 20-9 20-20S35 4 24 4 4 13 4 24s9 20 20 20Z"/><path d="m16 24 6 6 10-12"/></svg>',
    error: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M24 44c11 0 20-9 20-20S35 4 24 4 4 13 4 24s9 20 20 20Z"/><path d="m18 18 12 12M30 18 18 30"/></svg>',
    warn: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M24 44c11 0 20-9 20-20S35 4 24 4 4 13 4 24s9 20 20 20Z"/><path d="M24 16v10M24 32v2"/></svg>',
    info: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M24 44c11 0 20-9 20-20S35 4 24 4 4 13 4 24s9 20 20 20Z"/><path d="M24 22v12M24 14v2"/></svg>',
  }
  const svg = icons[name] || icons.info
  return `<span class="svg-icon">${svg}</span>`
}

function showToast(type, message, onClick) {
  if (!toastContainerEl) return
  const el = document.createElement("div")
  el.className = `toast-item toast-${type}`
  el.innerHTML = `<span class="toast-icon">${_svgIconForToast(type)}</span><span>${_escapeHtmlForToast(message)}</span>`
  if (typeof onClick === "function") {
    el.addEventListener("click", () => {
      onClick()
      dismissToast(el)
    })
  }
  toastContainerEl.appendChild(el)
  const timer = setTimeout(() => dismissToast(el), TOAST_AUTO_DISMISS_MS)
  el._dismissTimer = timer
}

function dismissToast(el) {
  if (!el || el._dismissed) return
  el._dismissed = true
  clearTimeout(el._dismissTimer)
  el.classList.add("toast-fade-out")
  setTimeout(() => el.remove(), 300)
}

// Expose to window for app.js, channel-app.js, discussion-engine.js, and other scripts
Object.assign(window, { showToast, dismissToast })
