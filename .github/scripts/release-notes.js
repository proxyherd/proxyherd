#!/usr/bin/env node
// Prints the GitHub release body for a version, taken from the website changelog
// (packages/website/intro/changelog.json). Used by .github/workflows/build.yml.
const { readFileSync } = require('fs');
const { join } = require('path');

const version = process.argv[ 2 ];

if (!version) {
    console.error('usage: release-notes.js <version>');
    process.exit(1);
}

const changelogPath = join(__dirname, '..', '..', 'packages', 'website', 'intro', 'changelog.json');
const { releases } = JSON.parse(readFileSync(changelogPath, 'utf8'));
const release = releases.find((r) => r.version === version);

if (!release) {
    console.error(`no entry for ${version} in ${changelogPath}`);
    process.exit(1);
}

const site = 'https://proxyherd.github.io/proxyherd/';
// The changelog is written for the website, so its links are site-relative.
const absolute = (text) => text.replace(/href="\/proxyherd\//g, `href="${site}`);
const lines = [];

if (release.description) {
    lines.push(absolute(release.description), '');
}

if (release.breaking) {
    lines.push('## Breaking changes', '', absolute(release.breaking), '');
}

for (const group of release.commitGroups ?? []) {
    lines.push(`## ${group.title}`, '');

    for (const commit of group.commits) {
        lines.push(`- ${absolute(commit)}`);
    }

    lines.push('');
}

lines.push(
    '## Install',
    '',
    '```shell',
    `docker pull ghcr.io/proxyherd/proxyherd:${version}`,
    `docker pull ghcr.io/proxyherd/fingerprint:${version}`,
    `npm install -g proxyherd@${version}`,
    '```',
    '',
    `Documentation: ${site}`
);

process.stdout.write(`${lines.join('\n')}\n`);
