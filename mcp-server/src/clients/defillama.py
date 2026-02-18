"""
DefiLlama API 客户端
DeFi收益率查询

官方文档: https://defillama.com/docs/api
认证: 完全免费，无需API key
限制: 无明确限制，但建议合理使用
"""

from typing import Optional, Dict, Any, List
from src.clients.base import BaseClient, APIError
from src.chains import get_defillama_chain
from src.models import DefiPool


class DefiLlamaClient(BaseClient):
    """
    DefiLlama DeFi数据API客户端
    
    功能:
    - 获取DeFi池收益率
    - 获取协议TVL
    - 获取链TVL
    - 获取历史数据
    
    使用示例:
        client = DefiLlamaClient()
        pools = await client.get_pools(chain="base", min_tvl=1000000, min_apy=5)
    """
    
    BASE_URL = "https://yields.llama.fi"
    TVL_BASE_URL = "https://api.llama.fi"
    
    def __init__(self, cache_ttl: int = 300):
        """
        初始化DefiLlama客户端
        
        Args:
            cache_ttl: 缓存时间（秒），默认5分钟
        """
        super().__init__(self.BASE_URL, cache_ttl=cache_ttl)
    
    async def get_all_pools(self) -> List[Dict[str, Any]]:
        """
        获取所有DeFi池
        
        Returns:
            所有池的列表
            
        注意: 数据量很大（~10000+个池），建议使用get_pools()过滤
        """
        data = await self.get("/pools")
        return data.get("data", [])
    
    async def get_pools(
        self,
        chain: Optional[str] = None,
        project: Optional[str] = None,
        min_tvl: float = 0,
        min_apy: float = 0,
        max_apy: float = 10000,
        stablecoin_only: bool = False,
        single_exposure: bool = False,
        limit: int = 50,
    ) -> List[DefiPool]:
        """
        获取DeFi池（带过滤）
        
        Args:
            chain: 链名过滤（ethereum, base, arbitrum等）
            project: 协议名过滤（aave, compound, uniswap等）
            min_tvl: 最小TVL（USD）
            min_apy: 最小APY（百分比）
            max_apy: 最大APY（过滤可疑高收益）
            stablecoin_only: 仅稳定币池
            single_exposure: 仅单币质押（无IL风险）
            limit: 返回数量限制
            
        Returns:
            过滤后的DefiPool列表
            
        使用示例:
            # 获取Base链上TVL>100万、APY>5%的稳定币池
            pools = await client.get_pools(
                chain="base",
                min_tvl=1000000,
                min_apy=5,
                stablecoin_only=True
            )
        """
        all_pools = await self.get_all_pools()
        
        # 转换链名
        chain_filter = get_defillama_chain(chain) if chain else None
        
        result = []
        for pool in all_pools:
            # 链过滤
            if chain_filter and pool.get("chain") != chain_filter:
                continue
            
            # 协议过滤
            if project and pool.get("project", "").lower() != project.lower():
                continue
            
            # TVL过滤
            tvl = pool.get("tvlUsd", 0) or 0
            if tvl < min_tvl:
                continue
            
            # APY过滤
            apy = pool.get("apy", 0) or 0
            if apy < min_apy or apy > max_apy:
                continue
            
            # 稳定币过滤
            if stablecoin_only and not pool.get("stablecoin"):
                continue
            
            # 单币质押过滤
            if single_exposure and pool.get("exposure") != "single":
                continue
            
            result.append(DefiPool(
                pool_id=pool.get("pool", ""),
                chain=pool.get("chain", ""),
                project=pool.get("project", ""),
                symbol=pool.get("symbol", ""),
                tvl_usd=tvl,
                apy=apy,
                apy_base=pool.get("apyBase"),
                apy_reward=pool.get("apyReward"),
                reward_tokens=pool.get("rewardTokens") or [],
                stablecoin=pool.get("stablecoin", False),
                il_risk=pool.get("ilRisk", "unknown"),
                underlying_tokens=pool.get("underlyingTokens") or [],
            ))
            
            if len(result) >= limit:
                break
        
        # 按APY降序排序
        result.sort(key=lambda x: x.apy, reverse=True)
        
        return result
    
    async def get_pool_by_id(self, pool_id: str) -> Optional[DefiPool]:
        """
        按ID获取特定池
        
        Args:
            pool_id: 池ID（DefiLlama的UUID）
            
        Returns:
            DefiPool或None
        """
        all_pools = await self.get_all_pools()
        
        for pool in all_pools:
            if pool.get("pool") == pool_id:
                return DefiPool(
                    pool_id=pool.get("pool", ""),
                    chain=pool.get("chain", ""),
                    project=pool.get("project", ""),
                    symbol=pool.get("symbol", ""),
                    tvl_usd=pool.get("tvlUsd", 0) or 0,
                    apy=pool.get("apy", 0) or 0,
                    apy_base=pool.get("apyBase"),
                    apy_reward=pool.get("apyReward"),
                    reward_tokens=pool.get("rewardTokens") or [],
                    stablecoin=pool.get("stablecoin", False),
                    il_risk=pool.get("ilRisk", "unknown"),
                    underlying_tokens=pool.get("underlyingTokens") or [],
                )
        
        return None
    
    async def get_protocol_tvl(self, protocol: str) -> Dict[str, Any]:
        """
        获取协议TVL
        
        Args:
            protocol: 协议名（如 aave, uniswap）
            
        Returns:
            协议TVL数据
        """
        # 使用TVL API
        client = BaseClient(self.TVL_BASE_URL, cache_ttl=self.cache_ttl)
        try:
            return await client.get(f"/protocol/{protocol}")
        finally:
            await client.close()
    
    async def get_chains_tvl(self) -> List[Dict[str, Any]]:
        """
        获取所有链的TVL
        
        Returns:
            链TVL列表
        """
        client = BaseClient(self.TVL_BASE_URL, cache_ttl=self.cache_ttl)
        try:
            return await client.get("/v2/chains")
        finally:
            await client.close()
    
    async def get_top_yields(
        self,
        chain: Optional[str] = None,
        limit: int = 20
    ) -> List[DefiPool]:
        """
        获取顶级收益池（已过滤可疑项目）
        
        Args:
            chain: 链名过滤
            limit: 返回数量
            
        Returns:
            高质量收益池列表
        """
        return await self.get_pools(
            chain=chain,
            min_tvl=1000000,  # TVL > 100万
            min_apy=1,
            max_apy=100,  # APY < 100%（过滤庞氏骗局）
            limit=limit,
        )
