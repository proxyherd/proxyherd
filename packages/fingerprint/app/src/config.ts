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
    trustProxy: boolean;
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
        trustProxy: parseBoolean(
            process.env.TRUST_PROXY,
            false
        ),
        downloadTimeoutMs: parseInt(
            process.env.GEOIP_DOWNLOAD_TIMEOUT ?? '600000',
            10
        ),
    };
}
