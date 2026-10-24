const {promises: fs} = require('fs');
const {composePlugins, withNx} = require('@nx/webpack');
const {createLockFile, getLockFileName} = require('@nx/js');
const {detectPackageManager, readCachedProjectGraph} = require('@nx/devkit');
const {relative} = require('path');


module.exports = composePlugins(withNx(), (config) => {
    config.plugins.push({
        apply: (compiler) => {
            // Add shebang to the fingerprint.js file (taken from the compiler so that
            // webpack itself is not recorded as a dependency of the published package)
            new compiler.webpack.BannerPlugin({banner: '#!/usr/bin/env node', raw: true}).apply(compiler);

            compiler.hooks.afterEmit.tapPromise('AfterEmitPlugin', async () => {
                const packageJsonRoot = JSON.parse(await fs.readFile('package.json'));
                const packageJsonSrc = JSON.parse(await fs.readFile('packages/fingerprint/app/package.json'));
                const packageJsonDist = JSON.parse(await fs.readFile('dist/fingerprint/package.json'));

                // Nx lists every npm package reachable in the project graph, which includes
                // the peers of @nestjs/core and the imports of @proxyherd/common that this
                // service never loads. Keep the declared dependencies only, with the
                // versions Nx resolved, and prune the lock file to match.
                const keep = Object.keys(packageJsonSrc.dependencies);
                packageJsonDist.dependencies = Object.fromEntries(
                    Object.entries(packageJsonDist.dependencies).filter(([name]) => keep.includes(name))
                );

                // Version follows the root package.json
                packageJsonDist.version = packageJsonRoot.version;
                await fs.writeFile('dist/fingerprint/package.json', JSON.stringify(packageJsonDist, null, 4));

                const packageManager = detectPackageManager();
                const lockFileName = getLockFileName(packageManager);
                const packageJsonLockDist = JSON.parse(createLockFile(packageJsonDist, readCachedProjectGraph(), packageManager));
                packageJsonLockDist.version = packageJsonRoot.version;
                packageJsonLockDist.packages[''].version = packageJsonRoot.version;
                await fs.writeFile(`dist/fingerprint/${lockFileName}`, JSON.stringify(packageJsonLockDist, null, 4));

                // Make the entry point executable and ship the package README
                await fs.chmod('dist/fingerprint/fingerprint.js', '755');
                await fs.copyFile('packages/fingerprint/app/README.md', 'dist/fingerprint/README.md');
            });
        }
    });

    config.output.devtoolModuleFilenameTemplate = (info) => {
        const rel = relative(process.cwd(), info.absoluteResourcePath);
        return `webpack:///./${rel}`
    }

    return config;
});
