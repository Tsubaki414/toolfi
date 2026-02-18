"""
ToolFi MCP Server
加密货币数据API聚合服务

使用FastMCP框架实现，提供以下工具：
- token_security: Token安全扫描（GoPlus）
- token_price: 价格查询（CoinGecko）
- defi_yields: DeFi收益率（DefiLlama）
- bridge_quote: 跨链桥报价（Li.Fi）
"""

import os
import json
from typing import Optional
from dataclasses import asdict

from mcp.server.fastmcp import FastMCP

from src.clients import GoPlusClient, CoinGeckoClient, DefiLlamaClient, LiFiClient
from src.models import RiskLevel

# 初始化MCP服务器
mcp = FastMCP(
    "ToolFi",
    instructions="Crypto data APIs - token security, prices, DeFi yields, bridge quotes"
)

# 初始化API客户端（单例）
goplus = GoPlusClient(api_key=os.getenv("GOPLUS_API_KEY"))
coingecko = CoinGeckoClient(api_key=os.getenv("COINGECKO_API_KEY"))
defillama = DefiLlamaClient()
lifi = LiFiClient()


# ============ Token Security (GoPlus) ============

@mcp.tool()
async def token_security(
    chain: str,
    address: str,
) -> str:
    """
    扫描Token合约安全性（蜜罐检测、税率、黑名单等）
    
    Args:
        chain: 链名 (ethereum, bsc, base, arbitrum, polygon, solana, optimism, avalanche)
        address: Token合约地址
        
    Returns:
        JSON格式的安全报告，包含：
        - 基本信息（名称、符号）
        - 风险等级（safe/low/medium/high/critical）
        - 风险因素列表
        - 详细指标（蜜罐、税率、可增发等）
    """
    try:
        result = await goplus.check_token_security(chain, address)
        
        # 构建人类可读的响应
        response = {
            "token": {
                "name": result.name,
                "symbol": result.symbol,
                "address": result.address,
                "chain": result.chain,
            },
            "risk": {
                "level": result.risk_level.value,
                "score": result.risk_score,
                "factors": result.risk_factors,
            },
            "details": {
                "is_honeypot": result.is_honeypot,
                "buy_tax": f"{result.buy_tax * 100:.1f}%",
                "sell_tax": f"{result.sell_tax * 100:.1f}%",
                "is_mintable": result.is_mintable,
                "can_take_back_ownership": result.can_take_back_ownership,
                "owner_change_balance": result.owner_change_balance,
                "hidden_owner": result.hidden_owner,
                "is_blacklisted": result.is_blacklisted,
                "transfer_pausable": result.transfer_pausable,
                "is_open_source": result.is_open_source,
                "is_proxy": result.is_proxy,
            },
            "market": {
                "holder_count": result.holder_count,
                "lp_holder_count": result.lp_holder_count,
                "is_in_cex": result.is_in_cex,
                "cex_list": result.cex_list,
                "dex_count": len(result.dex_info),
            },
        }
        
        return json.dumps(response, indent=2, ensure_ascii=False)
        
    except ValueError as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": f"API error: {str(e)}"}, ensure_ascii=False)


# ============ Token Price (CoinGecko) ============

@mcp.tool()
async def token_price(
    chain: str,
    address: str,
    include_market_cap: bool = False,
) -> str:
    """
    查询Token当前价格
    
    Args:
        chain: 链名 (ethereum, bsc, base, arbitrum, polygon, solana, optimism, avalanche)
        address: Token合约地址
        include_market_cap: 是否包含市值信息
        
    Returns:
        JSON格式的价格信息：
        - price_usd: 当前USD价格
        - change_24h: 24小时涨跌幅
        - market_cap: 市值（如果请求）
    """
    try:
        result = await coingecko.get_token_price(
            chain,
            address,
            include_market_cap=include_market_cap,
        )
        
        response = {
            "token": {
                "address": result.address,
                "chain": result.chain,
            },
            "price": {
                "usd": result.price_usd,
                "change_24h": f"{result.change_24h:.2f}%" if result.change_24h else None,
            },
        }
        
        if include_market_cap and result.market_cap:
            response["market_cap_usd"] = result.market_cap
        
        return json.dumps(response, indent=2, ensure_ascii=False)
        
    except ValueError as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": f"API error: {str(e)}"}, ensure_ascii=False)


@mcp.tool()
async def crypto_price(
    coin: str,
) -> str:
    """
    按名称查询主流币价格（比特币、以太坊等）
    
    Args:
        coin: 币种ID (bitcoin, ethereum, solana, etc.)
        
    Returns:
        价格信息
    """
    try:
        result = await coingecko.get_price_by_id(coin)
        
        if not result:
            return json.dumps({"error": f"Coin not found: {coin}"})
        
        return json.dumps({
            "coin": coin,
            "price_usd": result.get("usd"),
            "change_24h": f"{result.get('usd_24h_change', 0):.2f}%",
        }, indent=2)
        
    except Exception as e:
        return json.dumps({"error": str(e)})


# ============ DeFi Yields (DefiLlama) ============

@mcp.tool()
async def defi_yields(
    chain: Optional[str] = None,
    project: Optional[str] = None,
    min_tvl: float = 100000,
    min_apy: float = 1,
    max_apy: float = 100,
    stablecoin_only: bool = False,
    limit: int = 20,
) -> str:
    """
    查询DeFi收益率机会
    
    Args:
        chain: 链名过滤 (ethereum, base, arbitrum等，不填则查所有链)
        project: 协议名过滤 (aave, compound, uniswap等)
        min_tvl: 最小TVL，默认10万USD
        min_apy: 最小APY百分比，默认1%
        max_apy: 最大APY，默认100%（过滤可疑高收益）
        stablecoin_only: 仅显示稳定币池
        limit: 返回数量，默认20
        
    Returns:
        JSON格式的收益池列表：
        - pool_id: 池ID
        - chain: 链
        - project: 协议名
        - symbol: 交易对
        - tvl_usd: TVL
        - apy: 总APY
    """
    try:
        pools = await defillama.get_pools(
            chain=chain,
            project=project,
            min_tvl=min_tvl,
            min_apy=min_apy,
            max_apy=max_apy,
            stablecoin_only=stablecoin_only,
            limit=limit,
        )
        
        result = []
        for pool in pools:
            result.append({
                "pool_id": pool.pool_id,
                "chain": pool.chain,
                "project": pool.project,
                "symbol": pool.symbol,
                "tvl_usd": f"${pool.tvl_usd:,.0f}",
                "apy": f"{pool.apy:.2f}%",
                "apy_base": f"{pool.apy_base:.2f}%" if pool.apy_base else None,
                "apy_reward": f"{pool.apy_reward:.2f}%" if pool.apy_reward else None,
                "stablecoin": pool.stablecoin,
                "il_risk": pool.il_risk,
            })
        
        return json.dumps({
            "count": len(result),
            "pools": result,
        }, indent=2, ensure_ascii=False)
        
    except Exception as e:
        return json.dumps({"error": str(e)})


# ============ Bridge Quote (Li.Fi) ============

@mcp.tool()
async def bridge_quote(
    from_chain: str,
    to_chain: str,
    from_token: str,
    to_token: str,
    amount: str,
    from_address: str,
) -> str:
    """
    获取跨链桥报价
    
    Args:
        from_chain: 源链 (ethereum, base, arbitrum, polygon, optimism, bsc, avalanche)
        to_chain: 目标链
        from_token: 源Token (USDC, ETH, 或合约地址)
        to_token: 目标Token (USDC, ETH, 或合约地址)
        amount: 金额（最小单位，如USDC 1000元 = 1000000000）
        from_address: 发送方钱包地址
        
    Returns:
        JSON格式的报价：
        - from_amount/to_amount: 输入输出金额
        - gas_cost_usd: 预估gas费用
        - execution_time_seconds: 预估完成时间
        - bridge_name: 使用的桥
    """
    try:
        quote = await lifi.get_quote(
            from_chain=from_chain,
            to_chain=to_chain,
            from_token=from_token,
            to_token=to_token,
            amount=amount,
            from_address=from_address,
        )
        
        return json.dumps({
            "route": {
                "from_chain": quote.from_chain,
                "to_chain": quote.to_chain,
                "from_token": quote.from_token,
                "to_token": quote.to_token,
            },
            "amounts": {
                "from_amount": quote.from_amount,
                "to_amount": quote.to_amount,
                "to_amount_usd": f"${quote.to_amount_usd:.2f}" if quote.to_amount_usd else None,
            },
            "costs": {
                "gas_usd": f"${quote.gas_cost_usd:.2f}" if quote.gas_cost_usd else None,
            },
            "execution": {
                "time_seconds": quote.execution_time_seconds,
                "bridge": quote.bridge_name,
            },
        }, indent=2, ensure_ascii=False)
        
    except ValueError as e:
        return json.dumps({"error": str(e)})
    except Exception as e:
        return json.dumps({"error": f"API error: {str(e)}"})


# ============ Utility Tools ============

@mcp.tool()
async def supported_chains() -> str:
    """
    获取各API支持的链列表
    
    Returns:
        各服务支持的链
    """
    try:
        goplus_chains = await goplus.get_supported_chains()
        
        return json.dumps({
            "goplus": [c["name"] for c in goplus_chains],
            "coingecko": ["ethereum", "bsc", "polygon", "arbitrum", "base", "optimism", "avalanche", "solana"],
            "defillama": ["Ethereum", "BSC", "Polygon", "Arbitrum", "Base", "Optimism", "Avalanche", "Solana"],
            "lifi": ["ethereum", "arbitrum", "base", "polygon", "optimism", "bsc", "avalanche"],
        }, indent=2)
        
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
async def trending_coins() -> str:
    """
    获取CoinGecko热门币种
    
    Returns:
        热门币种列表
    """
    try:
        trending = await coingecko.get_trending()
        
        result = []
        for item in trending[:10]:
            coin = item.get("item", {})
            result.append({
                "name": coin.get("name"),
                "symbol": coin.get("symbol"),
                "market_cap_rank": coin.get("market_cap_rank"),
                "price_btc": coin.get("price_btc"),
            })
        
        return json.dumps({"trending": result}, indent=2)
        
    except Exception as e:
        return json.dumps({"error": str(e)})


# 主入口
def main():
    """运行MCP服务器（stdio模式，供Claude Desktop使用）"""
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
