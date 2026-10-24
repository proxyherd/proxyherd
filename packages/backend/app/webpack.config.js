const {promises: fs} = require('fs');
const {composePlugins, withNx} = require('@nx/webpack');
const {relative} = require('path')


module.exports = composePlugins(withNx(), (config) => {
    config.plugins.push({
        apply: (compiler) => {
            // Add shebang to the proxyherd.js file (taken from the compiler so that
            // webpack itself is not recorded as a dependency of the published package)
            new compiler.webpack.BannerPlugin({banner: "#!/usr/bin/env node", raw: true}).apply(compiler);

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
