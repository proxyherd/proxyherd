import { promises as fs } from 'fs';
import {
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';
import { open } from 'maxmind';
import {
    downloadToFile,
    extractFromTarGz,
} from './download';
import { networkFromPrefix } from './network';
import {
    EGeoipProvider,
    FINGERPRINT_SERVICE_CONFIG,
} from '../config';
import type { IFingerprintServiceConfig } from '../config';
import type {
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import type {
    AsnResponse,
    CityResponse,
    Response as MaxmindResponse,
    Reader,
} from 'maxmind';


export interface IGeoipLookup {
    asnName: string | null;
    asnNetwork: string | null;
    continentCode: string | null;
    continentName: string | null;
    countryCode: string | null;
    countryName: string | null;
    cityName: string | null;
    timezone: string | null;
    latitude: number | null;
    longitude: number | null;
}


export interface IGeoipStatus {
    provider: EGeoipProvider;
    attribution: string | null;
    city: boolean;
    asn: boolean;
    refreshedAt: string | null;
    lastError: string | null;
}


export const EMPTY_LOOKUP: IGeoipLookup = {
    asnName: null,
    asnNetwork: null,
    continentCode: null,
    continentName: null,
    countryCode: null,
    countryName: null,
    cityName: null,
    timezone: null,
    latitude: null,
    longitude: null,
};

const CITY_FILENAME = 'city.mmdb';
const ASN_FILENAME = 'asn.mmdb';
const DBIP_ATTRIBUTION = 'IP Geolocation by DB-IP (https://db-ip.com), CC BY 4.0';
const MAXMIND_ATTRIBUTION = 'This product includes GeoLite2 data created by MaxMind (https://www.maxmind.com)';


@Injectable()
export class GeoipService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(GeoipService.name);

    private cityReader: Reader<CityResponse> | undefined = void 0;

    private asnReader: Reader<AsnResponse> | undefined = void 0;

    private refreshedAt: Date | undefined = void 0;

    private lastError: string | undefined = void 0;

    private timer: NodeJS.Timeout | undefined = void 0;

    constructor(@Inject(FINGERPRINT_SERVICE_CONFIG) private readonly config: IFingerprintServiceConfig) {}

    async onModuleInit(): Promise<void> {
        if (this.config.provider === EGeoipProvider.None) {
            this.logger.log('GeoIP provider "none": responses carry the IP address only');

            return;
        }

        await fs.mkdir(
            this.config.dataDir,
            {
                recursive: true,
            }
        );

        const loaded = await this.load();

        if (!loaded && this.config.autoDownload) {
            await this.refresh();
        } else if (!loaded) {
            this.logger.warn(`No GeoIP database found in ${this.config.dataDir} and GEOIP_AUTO_DOWNLOAD is off: responses carry the IP address only`);
        }

        if (this.config.autoDownload && this.config.refreshIntervalMs > 0) {
            this.timer = setInterval(
                () => {
                    this.refresh()
                        .catch(() => void 0);
                },
                this.config.refreshIntervalMs
            );
            this.timer.unref();
        }
    }

    onModuleDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = void 0;
        }
    }

    get status(): IGeoipStatus {
        let attribution: string | null;

        switch (this.config.provider) {
            case EGeoipProvider.Dbip: {
                attribution = DBIP_ATTRIBUTION;
                break;
            }

            case EGeoipProvider.Maxmind: {
                attribution = MAXMIND_ATTRIBUTION;
                break;
            }

            default: {
                attribution = null;
            }
        }

        return {
            provider: this.config.provider,
            attribution,
            city: !!this.cityReader,
            asn: !!this.asnReader,
            refreshedAt: this.refreshedAt ? this.refreshedAt.toISOString() : null,
            lastError: this.lastError ?? null,
        };
    }

    lookup(ip: string): IGeoipLookup {
        const result: IGeoipLookup = {
            ...EMPTY_LOOKUP,
        };

        if (this.cityReader) {
            try {
                const city = this.cityReader.get(ip);

                if (city) {
                    result.continentCode = city.continent?.code ?? null;
                    result.continentName = city.continent?.names?.en ?? null;
                    result.countryCode = city.country?.iso_code ?? null;
                    result.countryName = city.country?.names?.en ?? null;
                    result.cityName = city.city?.names?.en ?? null;
                    result.timezone = city.location?.time_zone ?? null;
                    result.latitude = city.location?.latitude ?? null;
                    result.longitude = city.location?.longitude ?? null;
                }
            } catch (err: any) {
                this.logger.debug(`City lookup failed for ${ip}: ${err.message}`);
            }
        }

        if (this.asnReader) {
            try {
                const [
                    asn, prefixLength,
                ] = this.asnReader.getWithPrefixLength(ip);

                if (asn) {
                    result.asnName = asn.autonomous_system_organization ?? null;
                    result.asnNetwork = networkFromPrefix(
                        ip,
                        prefixLength
                    );
                }
            } catch (err: any) {
                this.logger.debug(`ASN lookup failed for ${ip}: ${err.message}`);
            }
        }

        return result;
    }

    async refresh(): Promise<void> {
        this.logger.log(`Downloading GeoIP databases from ${this.config.provider} into ${this.config.dataDir}`);

        try {
            switch (this.config.provider) {
                case EGeoipProvider.Dbip: {
                    await this.downloadDbip();
                    break;
                }

                case EGeoipProvider.Maxmind: {
                    await this.downloadMaxmind();
                    break;
                }

                default: {
                    return;
                }
            }

            await this.load();
            this.refreshedAt = new Date();
            this.lastError = void 0;
            this.logger.log('GeoIP databases updated');
        } catch (err: any) {
            this.lastError = err.message;
            this.logger.error(`GeoIP download failed: ${err.message}`);
        }
    }

    private async load(): Promise<boolean> {
        const [
            city, asn,
        ] = await Promise.all([
            this.openReader<CityResponse>(CITY_FILENAME), this.openReader<AsnResponse>(ASN_FILENAME),
        ]);

        if (city) {
            this.cityReader = city;
        }

        if (asn) {
            this.asnReader = asn;
        }

        if (city !== void 0 || asn !== void 0) {
            this.logger.log(`GeoIP databases loaded (city: ${!!city}, asn: ${!!asn})`);

            return true;
        }

        return false;
    }

    private async openReader<T extends MaxmindResponse>(filename: string): Promise<Reader<T> | undefined> {
        const path = `${this.config.dataDir}/${filename}`;

        try {
            await fs.access(path);
        } catch (err: any) {
            return void 0;
        }

        try {
            return await open<T>(path);
        } catch (err: any) {
            this.logger.warn(`Cannot open ${path}: ${err.message}`);

            return void 0;
        }
    }

    private async downloadDbip(): Promise<void> {
        // DB-IP publishes one file per month; early in a month the current one may not exist yet.
        const now = new Date();
        const months: string[] = [];

        for (let i = 0; i < 2; i++) {
            const d = new Date(Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth() - i,
                1
            ));
            months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1)
                .padStart(
                    2,
                    '0'
                )}`);
        }

        let lastError: Error | undefined;

        for (const month of months) {
            try {
                await downloadToFile(
                    `https://download.db-ip.com/free/dbip-city-lite-${month}.mmdb.gz`,
                    `${this.config.dataDir}/${CITY_FILENAME}`,
                    {
                        gunzip: true,
                        timeoutMs: this.config.downloadTimeoutMs,
                    }
                );
                await downloadToFile(
                    `https://download.db-ip.com/free/dbip-asn-lite-${month}.mmdb.gz`,
                    `${this.config.dataDir}/${ASN_FILENAME}`,
                    {
                        gunzip: true,
                        timeoutMs: this.config.downloadTimeoutMs,
                    }
                );

                return;
            } catch (err: any) {
                lastError = err;
                this.logger.warn(`DB-IP ${month} not available (${err.message}), trying the previous month`);
            }
        }

        throw lastError ?? new Error('DB-IP download failed');
    }

    private async downloadMaxmind(): Promise<void> {
        const editions: [string, string][] = [
            [
                'GeoLite2-City', CITY_FILENAME,
            ],
            [
                'GeoLite2-ASN', ASN_FILENAME,
            ],
        ];

        for (const [
            edition, filename,
        ] of editions) {
            const archive = `${this.config.dataDir}/${edition}.tar.gz`;
            await downloadToFile(
                `https://download.maxmind.com/app/geoip_download?edition_id=${edition}&license_key=${encodeURIComponent(this.config.maxmindLicenseKey as string)}&suffix=tar.gz`,
                archive,
                {
                    gunzip: false,
                    timeoutMs: this.config.downloadTimeoutMs,
                }
            );

            try {
                await extractFromTarGz(
                    archive,
                    `*/${edition}.mmdb`,
                    `${this.config.dataDir}/${filename}`
                );
            } finally {
                await fs.rm(
                    archive,
                    {
                        force: true,
                    }
                );
            }
        }
    }
}
