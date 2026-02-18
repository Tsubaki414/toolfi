"""
CoinGecko API 客户端
价格查询

官方文档: https://docs.coingecko.com/
认证: 
  - Demo API: 免费，30 req/min，无需key
  - Pro API: $129/月起，需要x-cg-pro-api-key header
限制:
  - Demo: 30 calls/minute
  - Pro: 500+ calls/minute
"""

from typing import Optional, Dict, Any, List
from src.clients.base import BaseClient, APIError
from src.chains import get_coingecko_platform
from src.models import TokenPrice


class CoinGeckoClient(BaseClient):
    """
    CoinGecko 价格查询API客户端
    
    功能:
    - 按合约地址查询Token价格
    - 按coin ID查询价格
    - 获取市场数据
    - 获取历史价格
    
    使用示例:
        client = CoinGeckoClient()
        price = await client.get_token_price("ethereum", "0xdac17f958d2ee523a2206206994597c13d831ec7")
    """
    
    BASE_URL = "https://api.coingecko.com/api/v3"
    PRO_BASE_URL = "https://pro-api.coingecko.com/api/v3"
    
    def __init__(self, api_key: Optional[str] = None, cache_ttl: int = 60):
        """
        初始化CoinGecko客户端
        
        Args:
            api_key: CoinGecko Pro API key（可选）
            cache_ttl: 缓存时间（秒），默认1分钟（价格数据需要较新）
        """
        base_url = self.PRO_BASE_URL if api_key else self.BASE_URL
        super().__init__(base_url, api_key, cache_ttl=cache_ttl)
    
    def _get_default_headers(self) -> Dict[str, str]:
        headers = super()._get_default_headers()
        if self.api_key:
            headers["x-cg-pro-api-key"] = self.api_key
        return headers
    
    async def get_token_price(
        self,
        chain: str,
        contract_address: str,
        include_24h_change: bool = True,
        include_market_cap: bool = False,
        include_volume: bool = False,
    ) -> TokenPrice:
        """
        按合约地址获取Token价格
        
        Args:
            chain: 链名（ethereum, bsc, base, arbitrum, polygon, solana等）
            contract_address: Token合约地址
            include_24h_change: 是否包含24小时变化
            include_market_cap: 是否包含市值
            include_volume: 是否包含24小时交易量
            
        Returns:
            TokenPrice对象
            
        Raises:
            APIError: API调用失败
            ValueError: 不支持的链或Token未找到
        """
        platform = get_coingecko_platform(chain)
        if not platform:
            raise ValueError(f"Unsupported chain: {chain}. Supported: ethereum, bsc, base, arbitrum, polygon, solana, etc.")
        
        address = contract_address.lower().strip()
        
        params = {
            "contract_addresses": address,
            "vs_currencies": "usd",
        }
        
        if include_24h_change:
            params["include_24hr_change"] = "true"
        if include_market_cap:
            params["include_market_cap"] = "true"
        if include_volume:
            params["include_24hr_vol"] = "true"
        
        data = await self.get(
            f"/simple/token_price/{platform}",
            params=params
        )
        
        if not data:
            raise APIError(f"Token not found: {address} on {chain}")
        
        token_data = data.get(address, {})
        
        if not token_data:
            raise APIError(f"Token not found: {address} on {chain}")
        
        return TokenPrice(
            address=address,
            chain=chain,
            price_usd=token_data.get("usd", 0),
            change_24h=token_data.get("usd_24h_change"),
            market_cap=token_data.get("usd_market_cap"),
            volume_24h=token_data.get("usd_24h_vol"),
        )
    
    async def get_price_by_id(
        self,
        coin_id: str,
        include_24h_change: bool = True,
        include_market_cap: bool = False,
    ) -> Dict[str, Any]:
        """
        按CoinGecko ID获取价格（如 bitcoin, ethereum）
        
        Args:
            coin_id: CoinGecko coin ID
            include_24h_change: 是否包含24小时变化
            include_market_cap: 是否包含市值
            
        Returns:
            价格信息字典
        """
        params = {
            "ids": coin_id,
            "vs_currencies": "usd",
        }
        
        if include_24h_change:
            params["include_24hr_change"] = "true"
        if include_market_cap:
            params["include_market_cap"] = "true"
        
        data = await self.get("/simple/price", params=params)
        
        return data.get(coin_id, {})
    
    async def get_multiple_token_prices(
        self,
        chain: str,
        contract_addresses: List[str],
    ) -> Dict[str, TokenPrice]:
        """
        批量获取Token价格
        
        Args:
            chain: 链名
            contract_addresses: Token合约地址列表（最多100个）
            
        Returns:
            地址 -> TokenPrice 的字典
        """
        platform = get_coingecko_platform(chain)
        if not platform:
            raise ValueError(f"Unsupported chain: {chain}")
        
        # CoinGecko限制每次最多100个地址
        addresses = [addr.lower().strip() for addr in contract_addresses[:100]]
        
        data = await self.get(
            f"/simple/token_price/{platform}",
            params={
                "contract_addresses": ",".join(addresses),
                "vs_currencies": "usd",
                "include_24hr_change": "true",
            }
        )
        
        result = {}
        for addr in addresses:
            token_data = data.get(addr, {})
            if token_data:
                result[addr] = TokenPrice(
                    address=addr,
                    chain=chain,
                    price_usd=token_data.get("usd", 0),
                    change_24h=token_data.get("usd_24h_change"),
                )
        
        return result
    
    async def search_coins(self, query: str) -> List[Dict[str, Any]]:
        """
        搜索Token
        
        Args:
            query: 搜索关键词
            
        Returns:
            匹配的币种列表
        """
        data = await self.get("/search", params={"query": query})
        return data.get("coins", [])
    
    async def get_coin_info(self, coin_id: str) -> Dict[str, Any]:
        """
        获取币种详细信息
        
        Args:
            coin_id: CoinGecko coin ID
            
        Returns:
            币种详细信息
        """
        return await self.get(
            f"/coins/{coin_id}",
            params={
                "localization": "false",
                "tickers": "false",
                "market_data": "true",
                "community_data": "false",
                "developer_data": "false",
            }
        )
    
    async def get_trending(self) -> List[Dict[str, Any]]:
        """
        获取热门币种
        
        Returns:
            热门币种列表
        """
        data = await self.get("/search/trending")
        return data.get("coins", [])
