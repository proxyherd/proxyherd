const {promises: fs} = require('fs');
const {composePlugins, withNx} = require('@nx/webpack');
const {BannerPlugin} = require('webpack');
const {relative} = require('path')


module.exports = composePlugins(withNx(), (config) => {
    // Add shebang to the proxyherd.js file
    config.plugins.push(new BannerPlugin({banner: "#!/usr/bin/env node", raw: true}));

    // Make the proxyherd.js file executable
    config.plugins.push({
        apply: (compiler) => {
            compiler.hooks.afterEmit.tapPromise('AfterEmitPlugin', async () => {
                // Add the version from the root package.json to the dist package.json
                const packageJsonRoot = JSON.parse(await fs.readFile('package.json'));
                const packageJsonDist = JSON.parse(await fs.readFile('dist/proxyherd/package.json'));
                packageJsonDist.version = packageJsonRoot.version;
                await fs.writeFile('dist/proxyherd/package.json', JSON.stringify(packageJsonDist, null, 4));

                // And to package-lock.json
                const packageJsonLockDist = JSON.parse(await fs.readFile('dist/proxyherd/package-lock.json'));
                packageJsonLockDist.version = packageJsonRoot.version;
                packageJsonLockDist.packages[''].version = packageJsonRoot.version;
                await fs.writeFile('dist/proxyherd/package-lock.json', JSON.stringify(packageJsonLockDist, null, 4));

                // Make the proxyherd.js file executable
                await fs.chmod('dist/proxyherd/proxyherd.js', '755');

                // Copy readme.md for NPM package
                await fs.copyFile('README.md', 'dist/proxyherd/README.md');
            });
        }
    });

    config.output.devtoolModuleFilenameTemplate = (info) => {
        const rel = relative(process.cwd(), info.absoluteResourcePath);
        return `webpack:///./${rel}`
    }

    return config;
});
