# Contribution Guidelines

Contributions are welcome, from a typo fix to a new connector.


## Bug Reports or Feature Requests

Report **bugs 🐞** or **request features 🤲** by [opening an issue](https://github.com/proxyherd/proxyherd/issues).
Questions and ideas that are not yet issues belong in [GitHub Discussions](https://github.com/proxyherd/proxyherd/discussions).


## Pull Requests

All pull requests are welcome! 👋👋👋

The following rules should be followed:
- **Sign-off**: Every commit must carry a `Signed-off-by` line (`git commit -s`), which certifies the [Developer Certificate of Origin](licence.md);
- **One pull request per feature**: If you want to do more than one thing, send multiple pull requests;
- **Create feature branches**: Don't ask us to pull from your main branch;
- **Commit messages**: Use the [Conventional Commits](https://www.conventionalcommits.org) format, enforced by commitlint (`feat(scope): ...`, `fix(scope): ...`);
- **Linter**: Run `npm run lint` to check your code before sending a pull request;
- **Tests**: Add tests for your code and make sure all tests pass before sending a pull request;
- **Documentation**: This is a mono-repository, so you can add documentation for your feature in the same pull request.

The pre-commit hook runs [gitleaks](https://github.com/gitleaks/gitleaks), the linter on staged files and commitlint.
Install gitleaks first (`brew install gitleaks` on macOS, or see its releases page).

Every pull request runs the CI workflow (`.github/workflows/ci.yml`): commit message check, linter, build,
the whole test suite and a gitleaks scan of the new commits. A pull request is merged only when all of them pass.


## Connectors

Connectors are tiered by how actively they are verified:
- **Tier 1** connectors are tested by the maintainers against real accounts.
- **Tier 2** connectors are maintained by the community. If you use one and can test it, say so in an issue labelled `connector/<name>`; a connector only leaves the project if its vendor disappears or its API is confirmed broken with nobody to maintain it.

Adding a connector is documented in [New Connector](connector.md).


## Code of Conduct

As contributors and maintainers of this project, we pledge to respect all people who contribute through reporting issues,
posting feature requests, updating documentation, submitting pull requests or patches, and other activities.

We are committed to making participation in this project a harassment-free experience for everyone,
regardless of the level of experience, gender, gender identity and expression, sexual orientation, disability, personal appearance, body size, race, age, or religion.

Examples of unacceptable behavior by participants include the use of sexual language or imagery,
derogatory comments or personal attacks, trolling, public or private harassment, insults, or other unprofessional conduct.

Project maintainers have the right and responsibility to remove, edit, or reject comments, commits, code, wiki edits, issues,
and other contributions that are not aligned to this Code of Conduct.
Project maintainers who do not follow the Code of Conduct may be removed from the project team.

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by opening an issue or contacting one
or more of the project maintainers.

This Code of Conduct is adapted from the Contributor Covenant, version 1.0.0,
available at [http://contributor-covenant.org/version/1/0/0](http://contributor-covenant.org/version/1/0/0/).
