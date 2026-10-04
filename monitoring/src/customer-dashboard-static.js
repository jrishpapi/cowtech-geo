import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ASSET_ROOT = path.resolve(process.cwd(), 'public/customer-dashboard');
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

function safeAssetPath(filename) {
  const resolved = path.resolve(ASSET_ROOT, filename);
  if (!resolved.startsWith(ASSET_ROOT)) {
    const error = new Error('invalid dashboard asset path');
    error.code = 'invalid_dashboard_asset_path';
    throw error;
  }
  return resolved;
}

export async function readCustomerDashboardAsset(filename) {
  const filePath = safeAssetPath(filename);
  return {
    body: await readFile(filePath, 'utf8'),
    contentType: CONTENT_TYPES[path.extname(filePath)] || 'text/plain; charset=utf-8'
  };
}
