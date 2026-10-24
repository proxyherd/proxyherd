import * as dotenv from 'dotenv';


if (process.env.DOTENV_FILE) {
    dotenv.config({
        path: process.env.DOTENV_FILE,
    });
}

export default {
    displayName: 'backend-test',
    preset: '../../../jest.preset.js',
    // Generous for the small CI runners; passing tests finish long before.
    testTimeout: 1000 * 30,
    setupFilesAfterEnv: [
        '<rootDir>/src/jest.setup.ts',
    ],
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
