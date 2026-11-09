# Releasing

Releases are automated by [`.github/workflows/release.yml`](.github/workflows/release.yml).

## How it works

- **Stable releases**: [release-please](https://github.com/googleapis/release-please) keeps a release PR open on
  `master`. It bumps `package.json` and writes `CHANGELOG.md` from the [conventional commits](https://www.conventionalcommits.org/)
  merged since the last release. Merging that PR tags `vX.Y.Z`, creates the GitHub release, and publishes the
  extension to the VS Code Marketplace.
- **Pre-releases**: every other push to `master` publishes a pre-release to the Marketplace, plus a GitHub
  pre-release with the `.vsix` attached. Running the workflow manually (Actions → Release → Run workflow) publishes a
  pre-release from the selected branch.
- **Pre-release versions** are `<stable major>.<stable minor>.<1000 + run number>`, e.g. `0.13.1042`. The
  Marketplace only accepts `X.Y.Z` and always serves the highest version, so pre-release patch numbers stay out of
  the range release-please uses for stable releases.

### Controlling the next version

- `fix:` bumps the patch, `feat:` the minor. While the version is `0.x`, breaking changes (`feat!:` or a
  `BREAKING CHANGE:` footer) also bump the minor instead of jumping to `1.0.0`.
- To pick a version explicitly, merge a commit with a `Release-As: 1.0.0` footer.
- For squash-merged PRs, the changelog uses the PR title. To write several entries for one PR, add them to the PR
  description before merging:

  ```
  BEGIN_COMMIT_OVERRIDE
  feat: first entry
  fix: second entry
  END_COMMIT_OVERRIDE
  ```

## Repository configuration

Nothing is published until `ENABLE_RELEASE` is `true`; before that the workflow only builds and tests.

| Kind                            | Name               | Purpose                                                                                                        |
| ------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Variable                        | `ENABLE_RELEASE`   | `true` turns publishing on.                                                                                    |
| Variable / secret               | `APP_CLIENT_ID` / `APP_PRIVATE_KEY` | Optional GitHub App used for the release PR, so CI runs on it (PRs opened by `GITHUB_TOKEN` don't trigger workflows). |
| Variable / secret               | `GA_MEASUREMENT_ID` / `GA_API_SECRET` | Optional; analytics are only compiled into the package when both are set.                    |
| Environment                     | `release`          | Used by the publish job; restrict it to `master` and add reviewers if publishes should need approval.       |

The VS Code Marketplace uses [Trusted Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
(`vsce publish --oidc`), so it needs no secret. The publisher has to trust this workflow (see below).

## One-time setup

### VS Code Marketplace (publisher `NativeScript`)

1. Sign in at <https://marketplace.visualstudio.com/manage> with an account that manages the `NativeScript`
   publisher.
2. Open the `NativeScript` publisher → **Trusted Publishing** → **Create**, and fill in:
   - **Policy name**: `nativescript-vscode-extension release`
   - **Repository owner**: `nativescript-community`
   - **Repository**: `nativescript-vscode-extension`
   - **Workflow**: `release.yml`
   - **Environment**: `release`
3. Select **Create**.

### GitHub

1. **Settings → Environments → New environment** `release`. Optionally limit deployment branches to `master` and
   add required reviewers.
2. If the organization blocks Actions from creating pull requests (**Settings → Actions → General → Workflow
   permissions → Allow GitHub Actions to create and approve pull requests**), either allow it or configure the
   `APP_CLIENT_ID` / `APP_PRIVATE_KEY` GitHub App (contents and pull requests: read and write on this repository).
3. **Settings → Secrets and variables → Actions → Variables**: add `ENABLE_RELEASE` = `true` once the Marketplace
   policy exists.
