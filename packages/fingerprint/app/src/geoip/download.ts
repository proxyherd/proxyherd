import { execFile } from 'child_process';
import {
    createWriteStream,
    promises as fs,
} from 'fs';
import { request as requestHttp } from 'http';
import { request as requestHttps } from 'https';
import {
    dirname,
    join,
} from 'path';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import type { IncomingMessage } from 'http';


const MAX_REDIRECTS = 5;


function get(
    url: string, timeoutMs: number
): Promise<IncomingMessage> {
    return new Promise<IncomingMessage>((
        resolve, reject
    ) => {
        const parsed = new URL(url);
        const request = parsed.protocol === 'https:' ? requestHttps : requestHttp;
        const req = request(
            parsed,
            {
                method: 'GET',
                headers: {
                    'User-Agent': 'ProxyHerd-fingerprint',
                },
                timeout: timeoutMs,
            },
            (res) => {
                resolve(res);
            }
        );

        req.on(
            'timeout',
            () => {
                req.destroy(new Error(`Timeout while downloading ${url}`));
            }
        );
        req.on(
            'error',
            reject
        );
        req.end();
    });
}


async function getFollowingRedirects(
    url: string, timeoutMs: number
): Promise<IncomingMessage> {
    let current = url;

    for (let i = 0; i <= MAX_REDIRECTS; i++) {
        const res = await get(
            current,
            timeoutMs
        );
        const status = res.statusCode ?? 0;

        if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            current = new URL(
                res.headers.location,
                current
            )
                .toString();

            continue;
        }

        if (status !== 200) {
            res.resume();

            throw new Error(`Download of ${current} failed with status ${status}`);
        }

        return res;
    }

    throw new Error(`Too many redirects while downloading ${url}`);
}


/**
 * Download a URL to a file. A ".gz" body is decompressed on the fly when `gunzip` is true.
 * The file is written to a temporary name and renamed at the end, so readers never see a partial file.
 */
export async function downloadToFile(
    url: string, destination: string, options: { gunzip: boolean; timeoutMs: number }
): Promise<void> {
    await fs.mkdir(
        dirname(destination),
        {
            recursive: true,
        }
    );

    const temporary = `${destination}.download`;
    const res = await getFollowingRedirects(
        url,
        options.timeoutMs
    );

    try {
        if (options.gunzip) {
            await pipeline(
                res,
                createGunzip(),
                createWriteStream(temporary)
            );
        } else {
            await pipeline(
                res,
                createWriteStream(temporary)
            );
        }

        await fs.rename(
            temporary,
            destination
        );
    } catch (err: any) {
        await fs.rm(
            temporary,
            {
                force: true,
            }
        );

        throw err;
    }
}


async function findFile(
    directory: string, filename: string
): Promise<string | null> {
    const entries = await fs.readdir(
        directory,
        {
            withFileTypes: true,
        }
    );

    for (const entry of entries) {
        const path = join(
            directory,
            entry.name
        );

        if (entry.isDirectory()) {
            const nested = await findFile(
                path,
                filename
            );

            if (nested) {
                return nested;
            }
        } else if (entry.name === filename) {
            return path;
        }
    }

    return null;
}


/**
 * Extract a single file matching `pattern` from a .tar.gz archive using the system tar
 * (present on Linux, macOS and the Alpine image), writing it to `destination`.
 */
export async function extractFromTarGz(
    archive: string, pattern: string, destination: string
): Promise<void> {
    const directory = dirname(destination);
    const scratch = join(
        directory,
        `.extract-${process.pid}`
    );
    await fs.mkdir(
        scratch,
        {
            recursive: true,
        }
    );

    try {
        await new Promise<void>((
            resolve, reject
        ) => {
            execFile(
                'tar',
                [
                    '-xzf',
                    archive,
                    '-C',
                    scratch,
                    '--wildcards',
                    pattern,
                ],
                (
                    err, stdout, stderr
                ) => {
                    if (err) {
                        reject(new Error(`tar failed: ${stderr.length > 0 ? stderr : err.message}`));

                        return;
                    }

                    resolve();
                }
            );
        });

        const found = await findFile(
            scratch,
            destination.split('/')
                .pop() as string
        );

        if (!found) {
            throw new Error(`${pattern} not found in ${archive}`);
        }

        await fs.rename(
            found,
            destination
        );
    } finally {
        await fs.rm(
            scratch,
            {
                recursive: true,
                force: true,
            }
        );
    }
}
