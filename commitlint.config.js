module.exports = {
    extends: [
        '@commitlint/config-conventional'
    ],
    // Dependabot writes its release notes into the commit body, with lines
    // longer than body-max-line-length allows.
    ignores: [
        (message) => message.includes('Signed-off-by: dependabot[bot]'),
    ],
};
