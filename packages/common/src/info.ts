// Identifiers that travel on the wire.
//
// The header, cookie and cloud-resource prefixes are kept at their Scrapoxy values on purpose:
// scrapers in the wild read `X-Scrapoxy-Proxyname` to report bans, sticky sessions rely on the
// `scrapoxy-proxyname` cookie, and connectors find existing cloud instances by the `scrapoxy` prefix.
// Changing them would break every migrating 4.17.4 install. Revisit in a major release.
export const SCRAPOXY_HEADER_PREFIX = 'X-Scrapoxy';

export const SCRAPOXY_HEADER_PREFIX_LC = SCRAPOXY_HEADER_PREFIX.toLowerCase();

export const SCRAPOXY_COOKIE_PREFIX = 'scrapoxy';

export const SCRAPOXY_DATACENTER_PREFIX = 'scrapoxy';

// The user agent is only sent to the fingerprint service, which is ours, so it carries the new name.
export const SCRAPOXY_USER_AGENT_PREFIX = 'ProxyHerd';
