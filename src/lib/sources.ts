export const METATRAY_REPOSITORY = 'https://github.com/fourtyeightTech/metabrain';
export const META_REPOSITORY = 'https://github.com/facebookresearch/tribev2';
export const META_REVISION = 'af58661791a351a448a489042a28f6c37e1c14b7';
export const META_INFERENCE_CODE = `${META_REPOSITORY}/blob/${META_REVISION}/tribev2/demo_utils.py`;
export const META_MODEL_CODE = `${META_REPOSITORY}/blob/${META_REVISION}/tribev2/model.py`;
export const METATRAY_ADAPTER_CODE = `${METATRAY_REPOSITORY}/blob/main/services/tribe/adapter.py`;
export const METATRAY_CHAIN_CODE = `${METATRAY_REPOSITORY}/blob/main/src/lib/server/chain.ts`;
export function transactionUrl(explorer: string | null | undefined, hash: string) {
  if (!explorer || !/^0x[0-9a-f]{64}$/i.test(hash)) return null;
  try { const u = new URL(explorer); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash
    ? `${u.href.replace(/\/$/, '')}/tx/${hash}` : null; } catch { return null; }
}
