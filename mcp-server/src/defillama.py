"""
DefiLlama API Wrapper

Provides DeFi protocol data:
- Yield farming opportunities
- TVL rankings
- Protocol information

API Documentation: https://defillama.com/docs/api
Completely free, no API key required.
"""

import httpx
from typing import Optional, List
from pydantic import BaseModel


class YieldPool(BaseModel):
    """DeFi yield pool data"""
    pool_id: str
    chain: str
    project: str
    symbol: str
    tvl_usd: float
    apy: float
    apy_base: Optional[float] = None
    apy_reward: Optional[float] = None
    reward_tokens: List[str] = []
    pool_meta: Optional[str] = None
    il_risk: Optional[str] = None  # Impermanent loss risk
    exposure: Optional[str] = None
    stable_coin: bool = False
    underlying_tokens: List[str] = []


class Protocol(BaseModel):
    """DeFi protocol data"""
    name: str
    slug: str
    tvl: float
    chain: Optional[str] = None
    chains: List[str] = []
    category: Optional[str] = None
    symbol: Optional[str] = None
    change_1h: Optional[float] = None
    change_1d: Optional[float] = None
    change_7d: Optional[float] = None


class DefiLlamaClient:
    """
    DefiLlama API Client
    
    Completely free, no authentication required.
    
    Usage:
        client = DefiLlamaClient()
        yields = await client.get_yields(chain="base", min_tvl=1000000)
        protocols = await client.get_protocols()
    """
    
    BASE_URL = "https://api.llama.fi"
    YIELDS_URL = "https://yields.llama.fi"
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def get_yields(
        self,
        chain: Optional[str] = None,
        project: Optional[str] = None,
        min_tvl: float = 0,
        min_apy: float = 0,
        stable_only: bool = False,
        limit: int = 50
    ) -> List[YieldPool]:
        """
        Get DeFi yield farming opportunities.
        
        Args:
            chain: Filter by chain (e.g., "Base", "Ethereum", "Arbitrum")
            project: Filter by project (e.g., "aave-v3", "uniswap-v3")
            min_tvl: Minimum TVL in USD
            min_apy: Minimum APY percentage
            stable_only: Only show stablecoin pools
            limit: Maximum results to return
            
        Returns:
            List of YieldPool sorted by APY (highest first)
        """
        url = f"{self.YIELDS_URL}/pools"
        response = await self.client.get(url)
        response.raise_for_status()
        
        data = response.json()
        pools = data.get("data", [])
        
        results = []
        for pool in pools:
            # Apply filters
            if chain and pool.get("chain", "").lower() != chain.lower():
                continue
            if project and pool.get("project", "").lower() != project.lower():
                continue
            if pool.get("tvlUsd", 0) < min_tvl:
                continue
            if pool.get("apy", 0) < min_apy:
                continue
            if stable_only and not pool.get("stablecoin", False):
                continue
            
            # Skip pools with no APY data
            apy = pool.get("apy")
            if apy is None or apy == 0:
                continue
            
            results.append(YieldPool(
                pool_id=pool.get("pool", ""),
                chain=pool.get("chain", ""),
                project=pool.get("project", ""),
                symbol=pool.get("symbol", ""),
                tvl_usd=pool.get("tvlUsd", 0),
                apy=pool.get("apy", 0),
                apy_base=pool.get("apyBase"),
                apy_reward=pool.get("apyReward"),
                reward_tokens=pool.get("rewardTokens") or [],
                pool_meta=pool.get("poolMeta"),
                il_risk=pool.get("ilRisk"),
                exposure=pool.get("exposure"),
                stable_coin=pool.get("stablecoin", False),
                underlying_tokens=pool.get("underlyingTokens") or [],
            ))
            
            if len(results) >= limit:
                break
        
        # Sort by APY
        results.sort(key=lambda x: x.apy, reverse=True)
        return results[:limit]
    
    async def get_top_yields(
        self,
        chain: Optional[str] = None,
        min_tvl: float = 1_000_000,
        limit: int = 20
    ) -> List[YieldPool]:
        """
        Get top yield opportunities with reasonable TVL.
        
        Filters for pools with >$1M TVL by default to avoid risky small pools.
        
        Args:
            chain: Filter by chain
            min_tvl: Minimum TVL (default $1M)
            limit: Max results
            
        Returns:
            Top yield pools sorted by APY
        """
        return await self.get_yields(
            chain=chain,
            min_tvl=min_tvl,
            limit=limit
        )
    
    async def get_stable_yields(
        self,
        chain: Optional[str] = None,
        min_tvl: float = 1_000_000,
        limit: int = 20
    ) -> List[YieldPool]:
        """
        Get stablecoin yield opportunities.
        
        Lower risk options with stablecoin pairs.
        
        Args:
            chain: Filter by chain
            min_tvl: Minimum TVL (default $1M)
            limit: Max results
            
        Returns:
            Stablecoin yield pools sorted by APY
        """
        return await self.get_yields(
            chain=chain,
            min_tvl=min_tvl,
            stable_only=True,
            limit=limit
        )
    
    async def get_protocols(
        self,
        chain: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 50
    ) -> List[Protocol]:
        """
        Get DeFi protocols ranked by TVL.
        
        Args:
            chain: Filter by chain
            category: Filter by category (e.g., "DEXes", "Lending", "Bridge")
            limit: Max results
            
        Returns:
            Protocols sorted by TVL (highest first)
        """
        url = f"{self.BASE_URL}/protocols"
        response = await self.client.get(url)
        response.raise_for_status()
        
        protocols = response.json()
        
        results = []
        for proto in protocols:
            # Apply filters
            if chain:
                chains = proto.get("chains", [])
                if chain not in chains and chain.lower() not in [c.lower() for c in chains]:
                    continue
            
            if category:
                proto_category = proto.get("category", "")
                if proto_category.lower() != category.lower():
                    continue
            
            results.append(Protocol(
                name=proto.get("name", ""),
                slug=proto.get("slug", ""),
                tvl=proto.get("tvl", 0),
                chain=proto.get("chain"),
                chains=proto.get("chains", []),
                category=proto.get("category"),
                symbol=proto.get("symbol"),
                change_1h=proto.get("change_1h"),
                change_1d=proto.get("change_1d"),
                change_7d=proto.get("change_7d"),
            ))
            
            if len(results) >= limit:
                break
        
        return results
    
    async def get_chain_tvl(self) -> dict:
        """
        Get TVL by chain.
        
        Returns:
            Dict mapping chain name to TVL in USD
        """
        url = f"{self.BASE_URL}/v2/chains"
        response = await self.client.get(url)
        response.raise_for_status()
        
        chains = response.json()
        
        return {
            chain["name"]: chain.get("tvl", 0)
            for chain in chains
        }
    
    async def get_stablecoin_stats(self) -> dict:
        """
        Get stablecoin market data.
        
        Returns:
            Dict with total stablecoin market cap and top stablecoins
        """
        url = f"{self.BASE_URL}/stablecoins"
        response = await self.client.get(url)
        response.raise_for_status()
        
        data = response.json()
        
        stables = []
        for coin in data.get("peggedAssets", [])[:10]:
            stables.append({
                "name": coin.get("name"),
                "symbol": coin.get("symbol"),
                "market_cap": coin.get("circulating", {}).get("peggedUSD", 0),
                "price": coin.get("price"),
            })
        
        return {
            "total_market_cap": sum(s["market_cap"] for s in stables),
            "top_stablecoins": stables
        }
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


# Convenience functions
async def get_top_yields(chain: Optional[str] = None, limit: int = 20) -> List[YieldPool]:
    """Quick lookup for top yield opportunities."""
    client = DefiLlamaClient()
    try:
        return await client.get_top_yields(chain=chain, limit=limit)
    finally:
        await client.close()


async def get_stable_yields(chain: Optional[str] = None, limit: int = 20) -> List[YieldPool]:
    """Quick lookup for stablecoin yields."""
    client = DefiLlamaClient()
    try:
        return await client.get_stable_yields(chain=chain, limit=limit)
    finally:
        await client.close()
