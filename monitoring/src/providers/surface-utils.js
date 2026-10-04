export function buildObservationPrompt({ prompt }) {
  if (typeof prompt?.prompt_text !== 'string' || !prompt.prompt_text.trim()) {
    throw new TypeError('prompt.prompt_text must be a non-empty string');
  }

  return prompt.prompt_text;
}

export function collectText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(collectText).filter(Boolean).join('\n');
  if (!value || typeof value !== 'object') return '';

  const direct = ['text', 'content', 'snippet', 'title', 'answer']
    .map((key) => (typeof value[key] === 'string' ? value[key] : ''))
    .filter(Boolean);

  const nested = Object.entries(value)
    .filter(([key]) => !['text', 'content', 'snippet', 'title', 'answer'].includes(key))
    .map(([, nestedValue]) => collectText(nestedValue))
    .filter(Boolean);

  return [...direct, ...nested].join('\n');
}

export function collectUrls(value) {
  const urls = new Set();

  function visit(node) {
    if (!node) return;
    if (typeof node === 'string') {
      if (/^https?:\/\//i.test(node)) urls.add(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node !== 'object') return;
    for (const [key, nestedValue] of Object.entries(node)) {
      if (['url', 'uri', 'link', 'source', 'source_url', 'serpapi_link'].includes(key) && typeof nestedValue === 'string') {
        if (/^https?:\/\//i.test(nestedValue)) urls.add(nestedValue);
      }
      visit(nestedValue);
    }
  }

  visit(value);
  return [...urls];
}
