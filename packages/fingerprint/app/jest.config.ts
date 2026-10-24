export default {
    displayName: 'fingerprint-app',
    preset: '../../../jest.preset.js',
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                tsconfig: '<rootDir>/tsconfig.spec.json',
            },
        ],
    },
    testEnvironment: 'node',
};
