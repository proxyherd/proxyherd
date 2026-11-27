export enum EGeoipProvider {
    Dbip = 'dbip',
    Maxmind = 'maxmind',
    None = 'none',
}


export interface IFingerprintServiceConfig {
    port: number;
    provider: EGeoipProvider;
    dataDir: string;
    autoDownload: boolean;
    refreshIntervalMs: number;
    maxmindLicenseKey: string | undefined;
    // Number of reverse proxies in front of the service whose X-Forwarded-For entry is trusted (0: none)
    trustProxy: number;
    // Requests per minute accepted from one address on /api/json and /api/text (0: no limit)
    rateLimitPerMinute: number;
    downloadTimeoutMs: number;
}


export const FINGERPRINT_SERVICE_CONFIG = 'FINGERPRINT_SERVICE_CONFIG';


function parseBoolean(
    value: string | undefined, defaultValue: boolean
): boolean {
    if (value === undefined || value.length <= 0) {
        return defaultValue;
    }

    return [
        '1',
        'true',
        'yes',
        'on',
    ].includes(value.toLowerCase());
}


/**
 * TRUST_PROXY: `true` for one reverse proxy in front of the service, or the number of them.
 * Each trusted proxy accounts for one X-Forwarded-For entry, counted from the right, so the
 * address that is read is the one the outermost trusted proxy saw. Entries further left come
 * from the caller and are never used: a proxy that appends to the header (nginx, Cloudflare)
 * cannot be made to report an address of the caller's choosing.
 */
export function parseTrustProxy(value: string | undefined): number {
    if (value === undefined || value.length <= 0) {
        return 0;
    }

    if ((/^\d+$/).test(value)) {
        return parseInt(
            value,
            10
        );
    }

    return parseBoolean(
        value,
        false
    ) ? 1 : 0;
}


function parsePositiveInt(value: string | undefined): number {
    const parsed = parseInt(
        value ?? '0',
        10
    );

    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}


function parseProvider(value: string | undefined): EGeoipProvider {
    switch ((value ?? 'dbip').toLowerCase()) {
        case 'maxmind': {
            return EGeoipProvider.Maxmind;
        }

        case 'none': {
            return EGeoipProvider.None;
        }

        default: {
            return EGeoipProvider.Dbip;
        }
    }
}


export function getEnvConfig(): IFingerprintServiceConfig {
    const provider = parseProvider(process.env.GEOIP_PROVIDER);
    const maxmindLicenseKey = process.env.MAXMIND_LICENSE_KEY;

    if (provider === EGeoipProvider.Maxmind && !maxmindLicenseKey) {
        throw new Error('GEOIP_PROVIDER=maxmind requires MAXMIND_LICENSE_KEY (free at https://www.maxmind.com/en/geolite2/signup)');
    }

    return {
        port: parseInt(
            process.env.FINGERPRINT_PORT ?? '3000',
            10
        ),
        provider,
        dataDir: process.env.GEOIP_DIR ?? 'geoip',
        autoDownload: parseBoolean(
            process.env.GEOIP_AUTO_DOWNLOAD,
            true
        ),
        refreshIntervalMs: parseInt(
            process.env.GEOIP_REFRESH_HOURS ?? '168',
            10
        ) * 60 * 60 * 1000,
        maxmindLicenseKey,
        trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
        rateLimitPerMinute: parsePositiveInt(process.env.RATE_LIMIT_PER_MINUTE),
        downloadTimeoutMs: parseInt(
            process.env.GEOIP_DOWNLOAD_TIMEOUT ?? '600000',
            10
        ),
    };
}
