/**
 * ProxyHerd fingerprint service as a Cloudflare Worker.
 *
 * Same contract as packages/fingerprint/app, with no database to manage: Cloudflare attaches
 * geolocation and ASN data to every request (`request.cf`). Deploy with `npx wrangler deploy`
 * from this directory, then set FINGERPRINT_URL=https://<worker>.workers.dev/api/json.
 */

interface ICfProperties {
    asn?: number;
    asOrganization?: string;
    continent?: string;
    country?: string;
    city?: string;
    timezone?: string;
    latitude?: string;
    longitude?: string;
}

const CONTINENT_NAMES: Record<string, string> = {
    AF: 'Africa',
    AN: 'Antarctica',
    AS: 'Asia',
    EU: 'Europe',
    NA: 'North America',
    OC: 'Oceania',
    SA: 'South America',
};

function toNumber(value: string | undefined): number | null {
    if (value === undefined) {
        return null;
    }

    const parsed = parseFloat(value);

    return Number.isFinite(parsed) ? parsed : null;
}

export default {
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const ip = request.headers.get('CF-Connecting-IP') ?? '';
        const cf = ((request as unknown as { cf?: ICfProperties }).cf) ?? {};

        switch (url.pathname) {
            case '/api/json': {
                const countryCode = cf.country ?? null;
                const continentCode = cf.continent ?? null;

                return Response.json({
                    ip,
                    useragent: request.headers.get('User-Agent'),
                    asnName: cf.asOrganization ?? null,
                    asnNetwork: null,
                    continentCode,
                    continentName: continentCode ? CONTINENT_NAMES[ continentCode ] ?? null : null,
                    countryCode,
                    countryName: countryCode ? new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ?? null : null,
                    cityName: cf.city ?? null,
                    timezone: cf.timezone ?? null,
                    latitude: toNumber(cf.latitude),
                    longitude: toNumber(cf.longitude),
                });
            }

            case '/api/text': {
                return new Response(ip, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
            }

            case '/health': {
                return Response.json({ status: 'ok', provider: 'cloudflare' });
            }

            default: {
                return new Response(
                    'ProxyHerd fingerprint service (Cloudflare Worker)\nGET /api/json, GET /api/text, GET /health\n',
                    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
                );
            }
        }
    },
};
