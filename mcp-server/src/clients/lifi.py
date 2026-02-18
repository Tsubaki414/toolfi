"""
Li.Fi API 客户端
跨链桥路由

官方文档: https://docs.li.fi/
认证: 免费使用，无需API key（高流量需要联系获取）
限制: 无明确限制
"""

from typing import Optional, Dict, Any, List
from src.clients.base import BaseClient, APIError
from src.chains import get_lifi_chain_id
from src.models import BridgeQuote


class LiFiClient(BaseClient):
    """
    Li.Fi 跨链桥路由API客户端
    
    功能:
    - 获取跨链桥报价
    - 获取支持的链
    - 获取支持的Token
    - 构建跨链交易
    
    使用示例:
        client = LiFiClient()
        quote = await client.get_quote(
            from_chain="ethereum",
            to_chain="base",
            from_token="USDC",
            to_token="USDC",
            amount="1000000000",  # 1000 USDC (6 decimals)
            from_address="0x..."
        )
    """
    
    BASE_URL = "https://li.quest/v1"
    
    # 常用Token地址
    NATIVE_TOKEN = "0x0000000000000000000000000000000000000000"
    USDC_ADDRESSES = {
        1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",  # Ethereum
        42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",  # Arbitrum
        8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # Base
        137: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",  # Polygon
        10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",  # Optimism
    }
    
    def __init__(self, cache_ttl: int = 30):
        """
        初始化Li.Fi客户端
        
        Args:
            cache_ttl: 缓存时间（秒），默认30秒（报价变化快）
        """
        super().__init__(self.BASE_URL, cache_ttl=cache_ttl)
    
    async def get_chains(self) -> List[Dict[str, Any]]:
        """
        获取支持的链列表
        
        Returns:
            支持的链列表
        """
        data = await self.get("/chains")
        return data.get("chains", [])
    
    async def get_tokens(self, chain_id: Optional[int] = None) -> Dict[str, Any]:
        """
        获取支持的Token
        
        Args:
            chain_id: 链ID过滤（可选）
            
        Returns:
            Token列表
        """
        params = {}
        if chain_id:
            params["chains"] = str(chain_id)
        return await self.get("/tokens", params=params)
    
    async def get_quote(
        self,
        from_chain: str,
        to_chain: str,
        from_token: str,
        to_token: str,
        amount: str,
        from_address: str,
        slippage: float = 0.03,
    ) -> BridgeQuote:
        """
        获取跨链桥报价
        
        Args:
            from_chain: 源链名（ethereum, base, arbitrum等）
            to_chain: 目标链名
            from_token: 源Token地址或符号（USDC, ETH, 0x...）
            to_token: 目标Token地址或符号
            amount: 金额（最小单位，如USDC是6位小数）
            from_address: 发送方地址
            slippage: 滑点容忍度（默认3%）
            
        Returns:
            BridgeQuote对象
            
        Raises:
            APIError: API调用失败
            ValueError: 不支持的链
            
        使用示例:
            quote = await client.get_quote(
                from_chain="ethereum",
                to_chain="base", 
                from_token="USDC",
                to_token="USDC",
                amount="1000000000",  # 1000 USDC
                from_address="0x..."
            )
            print(f"预计收到: {quote.to_amount}")
            print(f"预计时间: {quote.execution_time_seconds}秒")
        """
        from_chain_id = get_lifi_chain_id(from_chain)
        to_chain_id = get_lifi_chain_id(to_chain)
        
        if not from_chain_id:
            raise ValueError(f"Unsupported source chain: {from_chain}")
        if not to_chain_id:
            raise ValueError(f"Unsupported destination chain: {to_chain}")
        
        # 解析Token地址
        from_token_addr = self._resolve_token(from_token, from_chain_id)
        to_token_addr = self._resolve_token(to_token, to_chain_id)
        
        params = {
            "fromChain": from_chain_id,
            "toChain": to_chain_id,
            "fromToken": from_token_addr,
            "toToken": to_token_addr,
            "fromAmount": amount,
            "fromAddress": from_address,
            "slippage": slippage,
        }
        
        data = await self.get("/quote", params=params, use_cache=False)
        
        if "error" in data:
            raise APIError(f"Li.Fi error: {data.get('message', data.get('error'))}")
        
        estimate = data.get("estimate", {})
        action = data.get("action", {})
        
        # 计算gas成本
        gas_costs = estimate.get("gasCosts", [])
        total_gas_usd = sum(float(g.get("amountUSD", 0)) for g in gas_costs)
        
        return BridgeQuote(
            from_chain=from_chain,
            to_chain=to_chain,
            from_token=from_token_addr,
            to_token=to_token_addr,
            from_amount=estimate.get("fromAmount", amount),
            to_amount=estimate.get("toAmount", "0"),
            to_amount_usd=float(estimate.get("toAmountUSD", 0)) if estimate.get("toAmountUSD") else None,
            gas_cost_usd=total_gas_usd if total_gas_usd > 0 else None,
            execution_time_seconds=estimate.get("executionDuration"),
            bridge_name=data.get("tool", ""),
            steps=data.get("includedSteps", []),
        )
    
    def _resolve_token(self, token: str, chain_id: int) -> str:
        """解析Token地址"""
        token_upper = token.upper()
        
        # Native token
        if token_upper in ("ETH", "NATIVE", "MATIC", "BNB", "AVAX"):
            return self.NATIVE_TOKEN
        
        # USDC shorthand
        if token_upper == "USDC":
            return self.USDC_ADDRESSES.get(chain_id, token)
        
        # 已经是地址
        if token.startswith("0x") and len(token) == 42:
            return token.lower()
        
        return token
    
    async def get_routes(
        self,
        from_chain: str,
        to_chain: str,
        from_token: str,
        to_token: str,
        amount: str,
    ) -> List[Dict[str, Any]]:
        """
        获取所有可用路由
        
        Args:
            from_chain: 源链名
            to_chain: 目标链名
            from_token: 源Token
            to_token: 目标Token
            amount: 金额
            
        Returns:
            可用路由列表
        """
        from_chain_id = get_lifi_chain_id(from_chain)
        to_chain_id = get_lifi_chain_id(to_chain)
        
        if not from_chain_id or not to_chain_id:
            raise ValueError("Unsupported chain")
        
        from_token_addr = self._resolve_token(from_token, from_chain_id)
        to_token_addr = self._resolve_token(to_token, to_chain_id)
        
        data = await self.get(
            "/routes",
            params={
                "fromChainId": from_chain_id,
                "toChainId": to_chain_id,
                "fromTokenAddress": from_token_addr,
                "toTokenAddress": to_token_addr,
                "fromAmount": amount,
            },
            use_cache=False
        )
        
        return data.get("routes", [])
    
    async def get_status(self, tx_hash: str, bridge: str) -> Dict[str, Any]:
        """
        获取跨链交易状态
        
        Args:
            tx_hash: 交易哈希
            bridge: 桥名称
            
        Returns:
            交易状态
        """
        return await self.get(
            "/status",
            params={
                "txHash": tx_hash,
                "bridge": bridge,
            },
            use_cache=False
        )
