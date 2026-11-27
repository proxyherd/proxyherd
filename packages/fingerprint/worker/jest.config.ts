export default {
    displayName: 'fingerprint-worker',
    preset: '../../../jest.preset.js',
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                tsconfig: '<rootDir>/tsconfig.spec.json',
            },
        ],
    },
    // The Worker only uses web standard APIs (Request, Response, URL, Intl), which Node.js provides too
    testEnvironment: 'node',
};
