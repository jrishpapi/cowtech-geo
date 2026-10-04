# Contributing

Use [Issues](https://github.com/jrishpapi/cowtech-geo/issues) for reproducible bugs and scoped feature requests. Include version, module, expected/actual behavior and redacted logs. Never attach credentials, cookies, customer data, databases or private runtime configuration.

Make focused pull requests against `main`. Preserve third-party licenses and modification notices, update documentation for configuration changes, and describe what you actually tested. Contributions you intentionally submit are under Apache-2.0 unless explicitly stated otherwise; third-party material retains its own terms.

For frontend changes, run `npm ci --ignore-scripts --no-audit --no-fund` and `npm run build` in `workbench/`, commit the resulting production CSS, and check both desktop and mobile pages. For application changes, verify the affected path in an isolated instance with your own test data. Do not use real paid providers or publish content without the relevant account owner's permission.

This initial source release does not bundle the private development test corpus. The published verification summaries distinguish local checks from operator-specific live integration validation. Do not label unexecuted tests as passing.
