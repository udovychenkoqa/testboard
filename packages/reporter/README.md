# @testboard/reporter

Playwright reporter that uploads blob results to Testboard and, optionally, triggers HTML report
generation. It is a drop-in replacement for `@cyborgtests/reporter-playwright-reports-server` 2.6.1: same
options, same requests, same behaviour on failure.

## Install

The package lives in the GitLab npm registry of the Testboard project. Point the `@testboard` scope at it
in the consuming repo's `.npmrc` (values come from env, nothing secret is committed):

```ini
@testboard:registry=${TESTBOARD_NPM_REGISTRY}
${TESTBOARD_NPM_REGISTRY_AUTH}:_authToken=${TESTBOARD_NPM_TOKEN}
```

- `TESTBOARD_NPM_REGISTRY`: `https://<gitlab>/api/v4/projects/<testboard project id>/packages/npm/`
- `TESTBOARD_NPM_REGISTRY_AUTH`: the same URL without the scheme, e.g.
  `//<gitlab>/api/v4/projects/<id>/packages/npm/`
- `TESTBOARD_NPM_TOKEN`: `CI_JOB_TOKEN` in GitLab CI (allow the consumer project in Testboard's
  _CI/CD → Job token permissions_), a personal or deploy token with `read_package_registry` locally.

```bash
yarn add -D -E @testboard/reporter
```

## Use

```ts
// playwright.config.ts
reporter: [
  ['blob', { outputFile: 'test-results/blob.zip' }], // must come first: its zip is what gets uploaded
  [
    '@testboard/reporter',
    {
      url: process.env.REPORTS_SERVER_URL,
      token: process.env.REPORTS_SERVER_TOKEN,
      reportPath: 'test-results/blob.zip',
      resultDetails: { project: 'hanimax', env: 'prod', testRun: process.env.CI_PIPELINE_ID },
      triggerReportGeneration: true,
    },
  ],
],
```

| Option                    | Default      | Meaning                                                                 |
| ------------------------- | ------------ | ----------------------------------------------------------------------- |
| `enabled`                 | `true`       | `false` turns the reporter off                                          |
| `url`                     | — (required) | Testboard base URL                                                      |
| `token`                   | —            | Testboard `API_TOKEN`, sent as `Authorization`                          |
| `reportPath`              | — (required) | Blob zip, relative to the working directory (absolute also works)       |
| `resultDetails`           | `{}`         | String metadata stored with the result (`project`, `testRun`, `env`, …) |
| `triggerReportGeneration` | `true`       | Generate the HTML report after upload                                   |
| `blobUploadTimeout`       | `600000`     | Upload timeout, ms                                                      |
| `requestTimeout`          | `60000`      | Fallback timeout, ms                                                    |
| `logProgress`             | `false`      | Log upload progress                                                     |

Sharded runs: give every shard the same `resultDetails.testRun`. Each shard only uploads; the server
generates one report once all shards have arrived.

On failure (missing blob, upload or generation error) the reporter throws, so the CI job fails visibly,
exactly like the Cyborg reporter.

## Switching back to Cyborg

Replace `@testboard/reporter` with `@cyborgtests/reporter-playwright-reports-server` in `package.json` and
`playwright.config.ts`. The options don't change.

## Releasing

Bump `version` in `package.json`, merge, then push a tag `reporter-v<version>`. Testboard's GitLab CI
builds and publishes it.
