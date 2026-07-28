/*
 * PostHog.
 *
 * Project 531417, US cloud — verified by region probe: us.i.posthog.com accepts
 * this key, eu.i.posthog.com returns 401. If the project is ever migrated, both
 * hosts below have to change together.
 *
 * The key is a public project key (phc_). It is meant to ship in client code
 * and can only write events, so committing it is fine. A personal key (phx_)
 * would not be.
 *
 * Loaded plainly rather than via PostHog's minified bootstrap snippet: the
 * snippet exists to queue calls fired before the library lands, and nothing
 * here fires an event before init.
 */
const KEY = "phc_r3JA6y2CKGTjzsDWwTAUqKMprSUMfQGaGZd2eXX9kyJL";

const script = document.createElement("script");
script.src = "https://us-assets.i.posthog.com/static/array.js";
script.defer = true;

script.addEventListener("load", () => {
  window.posthog.init(KEY, {
    api_host: "https://us.i.posthog.com",
    ui_host: "https://us.posthog.com",
    defaults: "2025-05-24",
    person_profiles: "identified_only",
  });
});

// Analytics must never be the reason the page fails. A blocked request here
// (ad blockers take this domain out routinely) should stay silent.
script.addEventListener("error", () => {});

document.head.appendChild(script);
