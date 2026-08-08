/**
 * Whether a nav link should render as the current page.
 *
 * Shared by Header and Sidebar so the two can never disagree about what is active.
 *
 * Matches on path SEGMENTS, not raw string prefixes. A naive `pathname.startsWith(href)`
 * lights up any route that merely begins with the same characters — `/new-listings`
 * would mark `/new-listing` active, and `/gains` would match a future `/gains-report`.
 * That class of bug appears the moment a route is renamed, which is precisely when nav
 * highlighting is least likely to be re-tested.
 *
 * Rules:
 *   isActivePath('/', '/')                        -> true
 *   isActivePath('/bsc', '/')                     -> false   home is exact-match only
 *   isActivePath('/new-listings', '/new-listings')-> true
 *   isActivePath('/new-listing', '/new-listings') -> false   not a segment boundary
 *   isActivePath('/dev/dashboard', '/dev')        -> true    section links cover children
 */
/**
 * The main navigation, defined once.
 *
 * Header and Sidebar both render from this. Previously each kept its own copy of every
 * href AND a separate hard-coded string in its isActive() call — two places per link
 * that had to be changed together. Renaming /listings to /new-listings updated the
 * hrefs but left the active checks pointing at the old paths, so those links simply
 * never highlighted. Deriving the active state from the same value makes that
 * impossible.
 */
export const NAV_LINKS = [
  { href: '/', label: 'Screener', icon: 'home' },
  { href: '/trending', label: 'Trending', icon: 'trending' },
  { href: '/new-listings', label: 'New Listings', icon: 'clock' },
  { href: '/price-predict', label: 'Price Predict', icon: 'predict' },
  { href: '/gains', label: 'Gains', icon: 'gains' },
  { href: '/watchlist', label: 'Watchlist', icon: 'watchlist' },
  // { href: '/list-your-token', label: 'List Token', icon: 'plus' },
] as const;

export type NavIcon = (typeof NAV_LINKS)[number]['icon'];

export function isActivePath(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;

  // Normalize away a trailing slash so '/gains/' and '/gains' behave the same.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const target = href.length > 1 ? href.replace(/\/+$/, '') : href;

  // The home link would otherwise prefix-match every route on the site.
  if (target === '/') return path === '/';

  return path === target || path.startsWith(`${target}/`);
}
