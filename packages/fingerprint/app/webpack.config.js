const {promises: fs} = require('fs');
const {composePlugins, withNx} = require('@nx/webpack');
const {BannerPlugin} = require('webpack');
const {relative} = require('path');


module.exports = composePlugins(withNx(), (config) => {
    // Add shebang to the fingerprint.js file
    config.plugins.push(new BannerPlugin({banner: '#!/usr/bin/env node', raw: true}));

    config.plugins.push({
        apply: (compiler) => {
            compiler.hooks.afterEmit.tapPromise('AfterEmitPlugin', async () => {
                // Version follows the root package.json
                const packageJsonRoot = JSON.parse(await fs.readFile('package.json'));
                const packageJsonDist = JSON.parse(await fs.readFile('dist/fingerprint/package.json'));
                packageJsonDist.version = packageJsonRoot.version;
                await fs.writeFile('dist/fingerprint/package.json', JSON.stringify(packageJsonDist, null, 4));

                const packageJsonLockDist = JSON.parse(await fs.readFile('dist/fingerprint/package-lock.json'));
                packageJsonLockDist.version = packageJsonRoot.version;
                packageJsonLockDist.packages[''].version = packageJsonRoot.version;
                await fs.writeFile('dist/fingerprint/package-lock.json', JSON.stringify(packageJsonLockDist, null, 4));

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
