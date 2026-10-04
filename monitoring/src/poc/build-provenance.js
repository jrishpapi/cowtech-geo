import { readFileSync } from 'node:fs';

export const BUILD_PROVENANCE_SCHEMA_VERSION = 'cowtech-build-provenance-v1';

const commitSha = /^[a-f0-9]{40}$/;

export function validateBuildProvenance(metadata, { expectedCheckpoint } = {}) {
  const errors = [];
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return Object.freeze({ valid: false, errors: Object.freeze(['build_metadata_missing_or_invalid']) });
  }
  if (metadata.schema_version !== BUILD_PROVENANCE_SCHEMA_VERSION) {
    errors.push('build_metadata_schema_version_invalid');
  }
  if (!commitSha.test(String(metadata.source_revision || ''))) {
    errors.push('build_source_revision_invalid');
  }
  if (!commitSha.test(String(metadata.phase0_baseline_checkpoint_commit || ''))) {
    errors.push('build_baseline_checkpoint_invalid');
  }
  if (
    expectedCheckpoint &&
    metadata.phase0_baseline_checkpoint_commit !== expectedCheckpoint
  ) {
    errors.push('build_baseline_checkpoint_mismatch');
  }
  return Object.freeze({
    valid: errors.length === 0,
    source_revision: metadata.source_revision || null,
    phase0_baseline_checkpoint_commit: metadata.phase0_baseline_checkpoint_commit || null,
    errors: Object.freeze(errors)
  });
}

export function readBuildProvenance(url) {
  try {
    return JSON.parse(readFileSync(url, 'utf8'));
  } catch {
    return null;
  }
}
