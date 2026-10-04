import { createHash } from 'node:crypto';

export function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizePromptForCollection(promptText) {
  if (typeof promptText !== 'string' || promptText.length === 0) {
    throw new TypeError('prompt_text must be a non-empty string');
  }
  return promptText.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

export function buildCollectionIdentity({ prompt_hash, surface, region, language, device, daily_bucket }) {
  for (const [name, value] of Object.entries({ prompt_hash, surface, region, language, device, daily_bucket })) {
    if (typeof value !== 'string' || !value) throw new TypeError(`${name} must be a non-empty string`);
  }
  return JSON.stringify({ prompt_hash, surface, region, language, device, daily_bucket });
}

export function buildCollectionKey({ prompt_text, surface, region, language, device, daily_bucket }) {
  const original_prompt_sha256 = sha256Hex(Buffer.from(prompt_text, 'utf8'));
  const normalized_prompt_hash = sha256Hex(normalizePromptForCollection(prompt_text));
  return {
    original_prompt_sha256,
    normalized_prompt_hash,
    collection_key: sha256Hex(
      buildCollectionIdentity({
        // Physical work must submit the stored prompt byte-for-byte. Two prompts
        // that normalize to the same text but have different bytes therefore
        // cannot safely share one collection task.
        prompt_hash: sha256Hex(`${normalized_prompt_hash}:${original_prompt_sha256}`),
        surface,
        region,
        language,
        device,
        daily_bucket
      })
    )
  };
}

export function buildObservationDemandKey({
  customer_id,
  brand_id,
  tracking_run_id,
  prompt_id,
  collection_key,
  contract_version
}) {
  for (const [name, value] of Object.entries({
    customer_id,
    brand_id,
    tracking_run_id,
    prompt_id,
    collection_key,
    contract_version
  })) {
    if (typeof value !== 'string' || !value) throw new TypeError(`${name} must be a non-empty string`);
  }
  return sha256Hex(
    JSON.stringify({ customer_id, brand_id, tracking_run_id, prompt_id, collection_key, contract_version })
  );
}
