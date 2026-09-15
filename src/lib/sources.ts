export const METATRAY_REPOSITORY = 'https://github.com/fourtyeightTech/metabrain';
export const META_REPOSITORY = 'https://github.com/facebookresearch/tribev2';
export const META_REVISION = 'af58661791a351a448a489042a28f6c37e1c14b7';
export const PONS_REPOSITORY = 'https://github.com/ponsdotdev/ponsfamily';
export const PONS_REVISION = 'cb5748a29e4d3a7af1c4e982baa9ed9194d25a8f';
export const META_INFERENCE_CODE = `${META_REPOSITORY}/blob/${META_REVISION}/tribev2/demo_utils.py`;
export const META_MODEL_CODE = `${META_REPOSITORY}/blob/${META_REVISION}/tribev2/model.py`;
export const PONS_LAUNCH_CODE = `${PONS_REPOSITORY}/blob/${PONS_REVISION}/contractsV2/src/v2/interfaces/ILaunchpadV2.sol`;
export const PONS_CURVE_CODE = `${PONS_REPOSITORY}/blob/${PONS_REVISION}/contractsV2/src/v2/PonsV2BondingCurve.sol`;
export const PONS_FACTORY_CODE = `${PONS_REPOSITORY}/blob/${PONS_REVISION}/contractsV2/src/v2/PonsV2LaunchFactory.sol`;
export const PONS_POOL_MANAGER_CODE = `${PONS_REPOSITORY}/blob/${PONS_REVISION}/contractsV2/lib/v4-core/src/interfaces/IPoolManager.sol`;
export const METATRAY_ADAPTER_CODE = `${METATRAY_REPOSITORY}/blob/main/services/tribe/adapter.py`;
export const METATRAY_CHAIN_CODE = `${METATRAY_REPOSITORY}/blob/main/src/lib/server/chain.ts`;
export function transactionUrl(explorer: string | null | undefined, hash: string) {
  if (!explorer || !/^0x[0-9a-f]{64}$/i.test(hash)) return null;
  try { const u = new URL(explorer); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash
    ? `${u.href.replace(/\/$/, '')}/tx/${hash}` : null; } catch { return null; }
}
