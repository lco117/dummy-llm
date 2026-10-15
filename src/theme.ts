import { cookieValue, t, type Lang } from "./i18n.ts";
import { escapeHtml } from "./ui.ts";

/**
 * Light and dark, resolved the same way the language is: the theme query parameter, then a cookie,
 * then the default.
 *
 * Nothing is guessed at runtime, because the theme has to be on the <html> element in the first byte.
 * A toggle that runs after paint is a page that flashes the wrong background at everybody who prefers
 * the other one.
 */

export type Theme = "dark" | "light";
export const DEFAULT_THEME: Theme = "dark";
export const THEME_COOKIE = "dummy_theme";
export const THEME_MAX_AGE = 60 * 60 * 24 * 365;

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

export function resolveTheme(request: Request, url: URL, fallback: Theme = DEFAULT_THEME): Theme {
  const fromQuery = url.searchParams.get("theme");
  if (isTheme(fromQuery)) return fromQuery;
  const fromCookie = cookieValue(request.headers.get("cookie"), THEME_COOKIE);
  if (isTheme(fromCookie)) return fromCookie;
  return fallback;
}

export function themeCookie(value: Theme): string {
  return THEME_COOKIE + "=" + value + "; Path=/; Max-Age=" + THEME_MAX_AGE + "; SameSite=Lax";
}

const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z"/></svg>';

/** A one-button switch. It shows the theme it would give you, not the one you are looking at. */
export function themeSwitch(theme: Theme, path: string, lang: Lang): string {
  const target: Theme = theme === "light" ? "dark" : "light";
  const label = escapeHtml(t(lang, target === "light" ? "theme.toLight" : "theme.toDark"));
  const href = path + "?lang=" + lang + "&amp;theme=" + target;
  return (
    '<a class="theme" href="' + href + '" rel="nofollow" aria-label="' + label + '" title="' + label + '">' +
    (target === "light" ? SUN : MOON) +
    "</a>"
  );
}
