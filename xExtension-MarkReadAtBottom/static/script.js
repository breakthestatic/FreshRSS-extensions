/*
 * Mark Read At Bottom - FreshRSS extension
 *
 * FreshRSS's "mark as read when scrolling" only marks an article once it has
 * scrolled completely past the top of the viewport. The last few articles in
 * the list can never do that, so they stay unread. This script detects when the
 * list is scrolled to the bottom and there is nothing left to load, then marks
 * the remaining unread articles that are loaded on the page.
 *
 * It deliberately does NOT use the global "mark all as read" action, which would
 * also mark articles that were never loaded or seen.
 */
(function () {
	'use strict';

	const BOTTOM_THRESHOLD_PX = 10; // How close to the bottom counts as "at the bottom"

	let frameId = 0;

	// main.js declares these with top-level let/function, so they live in the
	// shared global scope but not on window. typeof guards against them missing.
	function freshrssReady() {
		return typeof context !== 'undefined' && context &&
			typeof mark_read === 'function';
	}

	function scrollBox() {
		// Mirrors FreshRSS's own choice of scroll container in init_posts()
		return context.current_view === 'global' ?
			document.getElementById('panel') :
			document.scrollingElement;
	}

	function moreToLoad() {
		// FreshRSS removes #load_more once the last page has been loaded
		if (document.getElementById('load_more')) {
			return true;
		}
		return typeof load_more !== 'undefined' && load_more === true; // request in flight
	}

	function check() {
		if (!freshrssReady() || !context.auto_mark_scroll || context.anonymous) {
			return;
		}
		const box = scrollBox();
		if (!box || box.offsetHeight === 0 || box.scrollTop <= 0) {
			return; // Not scrollable or not scrolled at all
		}
		const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - BOTTOM_THRESHOLD_PX;
		if (!atBottom || moreToLoad()) {
			return;
		}
		const scope = box === document.scrollingElement ? document : box;
		let queued = 0;
		scope.querySelectorAll('.flux.not_read:not(.keep_unread)').forEach(function (div) {
			// Skip hidden articles. mark_read returns false when it skips one (e.g. already pending)
			if (div.offsetHeight > 0 && mark_read(div, true, true) !== false) {
				queued++;
			}
		});
		if (queued > 0) {
			flushMarkReadQueue();
		}
	}

	// mark_read(..., asBatch) queues IDs and sends them after a 1 s timer.
	// Send the queue now instead, still as a single request.
	function flushMarkReadQueue() {
		if (typeof send_mark_queue_tick !== 'function' ||
				typeof send_mark_read_queue_timeout === 'undefined') {
			return; // Internals changed: fall back to FreshRSS's own 1 s timer
		}
		clearTimeout(send_mark_read_queue_timeout);
		send_mark_queue_tick(null);
	}

	// At most one check per animation frame, so it reacts as soon as the bottom is reached
	function onScroll() {
		if (frameId === 0) {
			frameId = requestAnimationFrame(function () {
				frameId = 0;
				check();
			});
		}
	}

	// Capture phase catches scrolls on both the window and inner containers (#panel)
	document.addEventListener('scroll', onScroll, { capture: true, passive: true });
	window.addEventListener('resize', onScroll, { passive: true });
})();
