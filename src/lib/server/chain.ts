import { createPublicClient, http, parseAbi, decodeEventLog, encodeAbiParameters, keccak256,
  formatUnits, zeroAddress, type Address, type Hex, type Log, type PublicClient } from 'viem';
import type { DiscoveryConfig, LiveConfig } from './config';
import type { Tick } from '../types';

export const ERC20 = parseAbi(['function decimals() view returns (uint8)', 'function symbol() view returns (string)']);
export const CURVE = parseAbi([
  'function getReserves() view returns (uint256 quoteReserve,uint256 tokenReserve)',
  'event CurveBuy(address indexed buyer,address indexed recipient,uint256 quoteIn,uint256 tokensOut,uint256 fee,uint256 tax)',
  'event CurveSell(address indexed seller,address indexed recipient,uint256 tokensIn,uint256 quoteOut,uint256 fee,uint256 tax)'
]);
export const FACTORY = parseAbi([
  'struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }',
  'function getLaunchedToken(address token) view returns (LaunchedToken)',
  'function memeHook() view returns (address)', 'function poolManager() view returns (address)'
]);
export const V3 = parseAbi([
  'function token0() view returns (address)', 'function token1() view returns (address)',
  'event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)'
]);
export const V4 = parseAbi([
  'event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)'
]);
export interface MarketConfig {
  protocol: 'pons-v2' | 'uniswap-v3'; token: Address; quote: Address; tokenDecimals: number;
  quoteDecimals: number; tokenIs0: boolean; curve?: Address; pool?: Address; manager?: Address; poolId?: Hex;
}
export function makeClient(cfg: LiveConfig) {
  return createPublicClient({ transport: http(cfg.RPC_HTTP_URL, { timeout: 15000, retryCount: 2 }) });
}
async function assertContract(client: PublicClient, address: Address) {
  const code = await client.getCode({ address });
  if (!code || code === '0x') throw new Error(`No contract at configured ${address}`);
}
export function spotFromSqrt(sqrtPriceX96: bigint, tokenIs0: boolean, tokenDecimals: number, quoteDecimals: number): number {
  const ratio = (Number(sqrtPriceX96) / 2 ** 96) ** 2;
  const price = (tokenIs0 ? ratio : 1 / ratio) * 10 ** (tokenDecimals - quoteDecimals);
  if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid pool price');
  return price;
}
export async function discoverMarket(client: PublicClient, cfg: DiscoveryConfig): Promise<MarketConfig> {
  if (await client.getChainId() !== cfg.CHAIN_ID) throw new Error('RPC chain ID does not match CHAIN_ID');
  await assertContract(client, cfg.TOKEN_ADDRESS);
  const tokenDecimals = await client.readContract({ address: cfg.TOKEN_ADDRESS, abi: ERC20, functionName: 'decimals' });
  let quote: Address; let rest: Partial<MarketConfig>;
  if (cfg.MARKET_PROTOCOL === 'pons-v2') {
    if (!cfg.PONS_FACTORY_ADDRESS) throw new Error('Pons factory required');
    await assertContract(client, cfg.PONS_FACTORY_ADDRESS);
    const [hook, manager] = await Promise.all([
      client.readContract({ address: cfg.PONS_FACTORY_ADDRESS, abi: FACTORY, functionName: 'memeHook' }),
      client.readContract({ address: cfg.PONS_FACTORY_ADDRESS, abi: FACTORY, functionName: 'poolManager' })
    ]);
    if ((cfg.PONS_HOOK_ADDRESS && cfg.PONS_HOOK_ADDRESS.toLowerCase() !== hook.toLowerCase()) ||
        (cfg.V4_POOL_MANAGER_ADDRESS && cfg.V4_POOL_MANAGER_ADDRESS.toLowerCase() !== manager.toLowerCase())) throw new Error('Pons contract configuration mismatch');
    await Promise.all([hook, manager].map(a => assertContract(client, a)));
    const launch = await client.readContract({ address: cfg.PONS_FACTORY_ADDRESS!, abi: FACTORY,
      functionName: 'getLaunchedToken', args: [cfg.TOKEN_ADDRESS] });
    if (!launch.exists || launch.token.toLowerCase() !== cfg.TOKEN_ADDRESS.toLowerCase()) throw new Error('Token is not a launch in this Pons V2 factory');
    quote = launch.pairToken;
    const currency0 = cfg.TOKEN_ADDRESS.toLowerCase() < quote.toLowerCase() ? cfg.TOKEN_ADDRESS : quote;
    const currency1 = currency0 === quote ? cfg.TOKEN_ADDRESS : quote;
    const poolId = keccak256(encodeAbiParameters(
      [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'address' }],
      [currency0, currency1, launch.poolFee, launch.tickSpacing, hook]));
    rest = { curve: launch.curve, manager, poolId };
  } else {
    await assertContract(client, cfg.V3_POOL_ADDRESS!);
    const [a, b] = await Promise.all(['token0', 'token1'].map(functionName => client.readContract({
      address: cfg.V3_POOL_ADDRESS!, abi: V3, functionName: functionName as 'token0' | 'token1' })));
    if (![a, b].some(v => v.toLowerCase() === cfg.TOKEN_ADDRESS.toLowerCase())) throw new Error('V3 pool does not contain TOKEN_ADDRESS');
    const tokenIs0 = a.toLowerCase() === cfg.TOKEN_ADDRESS.toLowerCase();
    quote = tokenIs0 ? b : a; rest = { pool: cfg.V3_POOL_ADDRESS, tokenIs0 };
  }
  const quoteDecimals = quote === zeroAddress ? 18 : await client.readContract({ address: quote, abi: ERC20, functionName: 'decimals' });
  if (tokenDecimals > 36 || quoteDecimals > 36) throw new Error('Token decimals exceed supported display range');
  return { protocol: cfg.MARKET_PROTOCOL, token: cfg.TOKEN_ADDRESS, quote, tokenDecimals, quoteDecimals,
    tokenIs0: cfg.TOKEN_ADDRESS.toLowerCase() < quote.toLowerCase(), ...rest };
}
export function decodeSwap(log: Log, market: MarketConfig, chainId: number, ts: number, curvePrice?: number): Tick | null {
  if (log.removed || log.blockNumber === null || log.blockHash === null || log.transactionHash === null || log.logIndex === null) return null;
  let side: 'buy' | 'sell'; let tokenRaw: bigint; let quoteRaw: bigint; let price: number; let venue: Tick['venue'];
  let extra: Record<string, string> = {};
  const topic = log.topics as [Hex, ...Hex[]];
  const address = log.address.toLowerCase();
  if (market.curve && address === market.curve.toLowerCase()) {
    let event; try { event = decodeEventLog({ abi: CURVE, data: log.data, topics: topic }); } catch { return null; }
    if (event.eventName === 'CurveBuy') {
      side = 'buy'; tokenRaw = event.args.tokensOut; quoteRaw = event.args.quoteIn;
      extra = { feeRaw: event.args.fee.toString(), taxRaw: event.args.tax.toString() };
    } else {
      side = 'sell'; tokenRaw = event.args.tokensIn; quoteRaw = event.args.quoteOut;
      extra = { feeRaw: event.args.fee.toString(), taxRaw: event.args.tax.toString() };
    }
    price = curvePrice ?? Number(formatUnits(quoteRaw, market.quoteDecimals)) / Number(formatUnits(tokenRaw, market.tokenDecimals));
    venue = 'pons-v2-curve'; extra.priceBasis = curvePrice ? 'post-block curve reserve ratio' : 'effective execution ratio from event amounts';
  } else if (market.pool && address === market.pool.toLowerCase()) {
    let event; try { event = decodeEventLog({ abi: V3, data: log.data, topics: topic }); } catch { return null; }
    const a = event.args; const amount = market.tokenIs0 ? a.amount0 : a.amount1;
    if (!amount || !a.amount0 || !a.amount1) return null;
    side = amount < 0n ? 'buy' : 'sell'; tokenRaw = abs(amount); quoteRaw = abs(market.tokenIs0 ? a.amount1 : a.amount0);
    price = spotFromSqrt(a.sqrtPriceX96, market.tokenIs0, market.tokenDecimals, market.quoteDecimals);
    venue = 'uniswap-v3'; extra = { sqrtPriceX96: a.sqrtPriceX96.toString(), priceBasis: 'post-swap pool spot' };
  } else if (market.manager && address === market.manager.toLowerCase()) {
    let event; try { event = decodeEventLog({ abi: V4, data: log.data, topics: topic }); } catch { return null; }
    const a = event.args; if (a.id.toLowerCase() !== market.poolId?.toLowerCase()) return null;
    const amount = market.tokenIs0 ? a.amount0 : a.amount1;
    if (!amount || !a.amount0 || !a.amount1) return null;
    // V4 BalanceDelta is caller-relative, opposite to V3's pool-relative amounts.
    side = amount > 0n ? 'buy' : 'sell'; tokenRaw = abs(amount); quoteRaw = abs(market.tokenIs0 ? a.amount1 : a.amount0);
    price = spotFromSqrt(a.sqrtPriceX96, market.tokenIs0, market.tokenDecimals, market.quoteDecimals);
    venue = 'uniswap-v4'; extra = { sqrtPriceX96: a.sqrtPriceX96.toString(), priceBasis: 'post-swap pool spot' };
  } else return null;
  const quoteAmount = Number(formatUnits(quoteRaw, market.quoteDecimals));
  const tokenAmount = Number(formatUnits(tokenRaw, market.tokenDecimals));
  if (![quoteAmount, tokenAmount, price].every(v => Number.isFinite(v) && v > 0)) return null;
  return { id: `${chainId}:${log.transactionHash}:${log.logIndex}`, ts, price, side, quoteAmount, tokenAmount, venue,
    blockNumber: Number(log.blockNumber), blockHash: log.blockHash, txHash: log.transactionHash, logIndex: log.logIndex,
    raw: { quoteAmount: quoteRaw.toString(), tokenAmount: tokenRaw.toString(), ...extra } };
}
const abs = (v: bigint) => v < 0n ? -v : v;
export async function fetchLogs(client: PublicClient, market: MarketConfig, from: bigint, to: bigint) {
  const requests = market.protocol === 'uniswap-v3' ? [client.getLogs({ address: market.pool!, event: V3[2], fromBlock: from, toBlock: to })]
    : [client.getLogs({ address: market.curve!, events: [CURVE[1], CURVE[2]], fromBlock: from, toBlock: to }),
       client.getLogs({ address: market.manager!, event: V4[0], args: { id: market.poolId! }, fromBlock: from, toBlock: to })];
  return (await Promise.all(requests)).flat().sort((a, b) => Number(a.blockNumber! - b.blockNumber!) || a.logIndex! - b.logIndex!);
}
