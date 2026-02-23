/**
 * Block Sticky Header – frontend script (vanilla JS)
 * Finds header by selector, adds .bsh-header, applies sticky behavior and scroll effects.
 */

(function () {
	'use strict';

	var config = getConfig();
	if (!config || !config.enabled) return;

	// Respect reduced motion: disable shrink/hide animations
	var reducedMotion = typeof config.reduced_motion === 'boolean' ? config.reduced_motion : window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	function getConfig() {
		var el = document.getElementById('bsh-config');
		if (el && el.textContent) {
			try {
				return JSON.parse(el.textContent);
			} catch (e) {
				return null;
			}
		}
		return typeof blockStickyHeader !== 'undefined' ? blockStickyHeader : null;
	}

	function getHeaderElement() {
		var selectors = (config.selector || 'header.wp-block-template-part, .wp-site-blocks > header, .wp-site-blocks header').trim().split(',').map(function(s) { return s.trim(); });
		if (!selectors.length) return null;
		for (var s = 0; s < selectors.length; s++) {
			try {
				var list = document.querySelectorAll(selectors[s]);
				for (var i = 0; i < list.length; i++) {
					var el = list[i];
					if (isVisible(el)) return el;
				}
				if (list.length) return list[0];
			} catch (e) { /* skip invalid selector */ }
		}
		// Fallback: first header in document
		var first = document.querySelector('header');
		return first && isVisible(first) ? first : (first || null);
	}

	function isVisible(el) {
		if (!el || !el.getBoundingClientRect) return false;
		var rect = el.getBoundingClientRect();
		return rect.width > 0 && rect.height > 0;
	}

	function getAdminBarHeight() {
		if (!config.admin_bar_offset) return 0;
		var bar = document.getElementById('wpadminbar');
		return bar && isVisible(bar) ? bar.offsetHeight : 0;
	}

	function applyInlineStyles(header) {
		var top = getAdminBarHeight();
		var z = typeof config.z_index === 'number' ? config.z_index : 999;
		var speed = typeof config.transition_speed_ms === 'number' ? config.transition_speed_ms : 300;
		header.style.setProperty('--bsh-top', top + 'px');
		header.style.setProperty('--bsh-z-index', String(z));
		header.style.setProperty('--bsh-transition-duration', (reducedMotion ? 0 : speed) + 'ms');

		var bgStyle = config.background_style || 'none';
		if ((bgStyle === 'solid' || bgStyle === 'blur') && config.sticky_bg_color) {
			var opacity = typeof config.sticky_bg_opacity === 'number' ? config.sticky_bg_opacity : 0.98;
			var hex = config.sticky_bg_color.replace(/^#/, '');
			var r = parseInt(hex.substr(0, 2), 16);
			var g = parseInt(hex.substr(2, 2), 16);
			var b = parseInt(hex.substr(4, 2), 16);
			var rgba = 'rgba(' + r + ',' + g + ',' + b + ',' + opacity + ')';
			header.style.setProperty('--bsh-bg', rgba);
		}
		if (bgStyle === 'solid') {
			header.classList.add('bsh-has-bg', 'bsh-custom-bg');
		}
		if (bgStyle === 'blur' && !reducedMotion) {
			header.classList.add('bsh-has-bg', 'bsh-blur');
			header.style.setProperty('--bsh-blur-px', String(config.blur_amount_px || 10) + 'px');
		}
		if (bgStyle === 'chameleon') {
			header.classList.add('bsh-has-bg', 'bsh-custom-bg', 'bsh-chameleon');
		}
	}

	// Chameleon: find the background colour of the section currently behind the header.
	// Uses elementFromPoint to find the exact element at the check point, then walks UP
	// the DOM collecting colours, skipping full-page containers. Returns the outermost
	// section-level colour found (last match walking up = most outer section block).
	function getSectionColorBelowHeader(header) {
		var headerRect = header.getBoundingClientRect();
		var checkX = headerRect.left + headerRect.width / 2;
		var checkY = headerRect.bottom + 2;
		var vh = window.innerHeight || document.documentElement.clientHeight;

		// Temporarily hide header so elementFromPoint sees content underneath
		var prevVis = header.style.visibility;
		header.style.visibility = 'hidden';
		var el = document.elementFromPoint(checkX, checkY);
		header.style.visibility = prevVis;
		if (!el) return null;

		var result = null;
		var node = el;

		while (node && node !== document.documentElement && node !== document.body) {
			// Skip elements taller than 1.5× viewport — they are page containers, not sections
			if (node.offsetHeight < vh * 1.5) {
				var bg = window.getComputedStyle(node).backgroundColor;
				if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
					result = bg; // keep walking up — we want the outermost section match
				}
				// Cover block: check the dedicated overlay span for its colour + opacity
				if (node.classList && node.classList.contains('wp-block-cover')) {
					var overlay = node.querySelector('.wp-block-cover__background, .wp-block-cover__gradient-background');
					if (overlay) {
						var obg = window.getComputedStyle(overlay).backgroundColor;
						if (obg && obg !== 'rgba(0, 0, 0, 0)' && obg !== 'transparent') {
							var op = parseFloat(window.getComputedStyle(overlay).opacity);
							op = isNaN(op) ? 1 : op;
							var m = obg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
							if (m) result = 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + op + ')';
						}
					}
				}
			}
			node = node.parentElement;
		}

		return result;
	}

	function isMobile() {
		var bp = typeof config.mobile_breakpoint_px === 'number' ? config.mobile_breakpoint_px : 782;
		return window.innerWidth <= bp;
	}

	function shouldRun() {
		if (config.disable_mobile && isMobile()) return false;
		return true;
	}

	function getScrollY() {
		return window.pageYOffset || document.documentElement.scrollTop;
	}

	function init() {
		var header = getHeaderElement();
		if (!header) return;

		header.classList.add('bsh-header');

		var stuck = false;

		function updateStuck() {
			if (!shouldRun()) {
				if (stuck) {
					stuck = false;
					header.classList.remove('bsh-stuck', 'bsh-hidden', 'bsh-has-bg', 'bsh-custom-bg', 'bsh-blur', 'bsh-chameleon');
				header.style.removeProperty('--bsh-text-color');
					header.style.transform = '';
				}
				return;
			}
			if (!stuck) {
				stuck = true;
				header.classList.add('bsh-stuck');
				applyInlineStyles(header);
			}
		}

		// Hide on scroll down / reveal on scroll up
		var lastScrollY = getScrollY();
		var hideTimeout = null;
		var sensitivity = Math.max(1, config.hide_sensitivity_px || 10);
		var delay = Math.max(0, config.hide_delay_ms || 150);

		function updateHideShow() {
			if (!config.hide_on_scroll_down || !stuck || reducedMotion) {
				header.classList.remove('bsh-hidden');
				return;
			}
			var y = getScrollY();
			var delta = y - lastScrollY;
			if (delta > sensitivity && config.hide_on_scroll_down) {
				if (delay) {
					clearTimeout(hideTimeout);
					hideTimeout = setTimeout(function () {
						header.classList.add('bsh-hidden');
						applyTransform();
					}, delay);
				} else {
					header.classList.add('bsh-hidden');
					applyTransform();
				}
			} else if (delta < -sensitivity && config.reveal_on_scroll_up) {
				clearTimeout(hideTimeout);
				header.classList.remove('bsh-hidden');
				applyTransform();
			}
			lastScrollY = y;
		}

		function applyTransform() {
			var hidden = header.classList.contains('bsh-hidden');
			header.style.transform = hidden ? 'translateY(-100%)' : '';
		}

		function updateChameleon() {
			if ((config.background_style || 'none') !== 'chameleon' || !stuck) return;
			var color = getSectionColorBelowHeader(header);
			if (!color) {
				// No solid background detected (e.g. image-only section) — go transparent
				header.style.setProperty('--bsh-bg', 'rgba(0,0,0,0)');
				header.style.removeProperty('--bsh-text-color');
				return;
			}
			var match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
			if (!match) return;
			var r = parseInt(match[1], 10);
			var g = parseInt(match[2], 10);
			var b = parseInt(match[3], 10);
			var opacity = typeof config.sticky_bg_opacity === 'number' ? config.sticky_bg_opacity : 0.98;
			header.style.setProperty('--bsh-bg', 'rgba(' + r + ',' + g + ',' + b + ',' + opacity + ')');
			// Perceived luminance — switch text colour for contrast
			var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
			header.style.setProperty('--bsh-text-color', luminance > 0.5 ? '#000000' : '#ffffff');
		}

		function onScroll() {
			updateStuck();
			if (header.classList.contains('bsh-stuck')) {
				updateHideShow();
				applyTransform();
				updateChameleon();
			}
			updateSpacerHeight();
		}

	var updateSpacerHeight = function () {};
	// Push content down: add spacer after header (overlay_content takes priority if both are enabled)
	if (config.push_content_down && !config.overlay_content) {
		var spacer = document.createElement('div');
		spacer.className = 'bsh-content-spacer';
		spacer.setAttribute('aria-hidden', 'true');
		if (header.nextElementSibling) {
			header.parentNode.insertBefore(spacer, header.nextElementSibling);
		} else {
			header.parentNode.appendChild(spacer);
		}
		updateSpacerHeight = function () {
			spacer.style.height = header.classList.contains('bsh-stuck') ? header.offsetHeight + 'px' : '0';
		};
		var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSpacerHeight) : null;
		if (ro) ro.observe(header);
	} else if (config.overlay_content) {
		var overlayTarget = header.nextElementSibling;
		var applyOverlayMargin = function () {
			if (!shouldRun()) {
				document.documentElement.style.setProperty('--bsh-header-height', '0px');
				if (overlayTarget) overlayTarget.style.marginTop = '';
				return;
			}
			var h = header.offsetHeight;
			document.documentElement.style.setProperty('--bsh-header-height', h + 'px');
			if (overlayTarget) {
				overlayTarget.style.marginTop = '-' + h + 'px';
			}
		};
		applyOverlayMargin();
		var overlayRo = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(applyOverlayMargin) : null;
		if (overlayRo) overlayRo.observe(header);
		updateSpacerHeight = applyOverlayMargin;
	}

		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', function () {
			updateStuck();
			updateSpacerHeight();
		});
		updateStuck();
		if (header.classList.contains('bsh-stuck')) {
			applyTransform();
			updateChameleon();
		}
		updateSpacerHeight();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
