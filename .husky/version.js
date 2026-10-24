const fs = require('fs');

// The root package.json is the single source of the version.
const packageJsonRoot = JSON.parse(fs.readFileSync('package.json'));

// Update root package-lock.json with version
const packageJsonLockRoot = JSON.parse(fs.readFileSync('package-lock.json'));
packageJsonLockRoot.version = packageJsonRoot.version;
packageJsonLockRoot.packages[''].version = packageJsonRoot.version;
fs.writeFileSync('package-lock.json', JSON.stringify(packageJsonLockRoot, null, 4));

// Update the Python client (published to PyPI from the same tag)
const setupPyPath = 'packages/python-api/src/setup.py';
const setupPy = fs.readFileSync(setupPyPath, 'utf8');
const setupPyUpdated = setupPy.replace(/^(\s*version=')[^']*(',)/m, `$1${packageJsonRoot.version}$2`);
if (setupPyUpdated !== setupPy) {
    fs.writeFileSync(setupPyPath, setupPyUpdated);
}
