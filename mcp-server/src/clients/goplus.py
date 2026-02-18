"""
GoPlus API 客户端
Token安全扫描

官方文档: https://docs.gopluslabs.io/
认证: 免费层无需API key，付费需要Bearer token
限制: 免费层有频率限制，约10 req/min
"""

from typing import Optional, Dict, Any, List
from src.clients.base import BaseClient, APIError
from src.chains import get_goplus_chain_id
from src.models import TokenSecurity


class GoPlusClient(BaseClient):
    """
    GoPlus Token安全扫描API客户端
    
    功能:
    - Token安全检测（蜜罐、税率、黑名单等）
    - 地址安全检测
    - NFT安全检测
    - dApp安全检测
    
    使用示例:
        client = GoPlusClient()
        result = await client.check_token_security("ethereum", "0x...")
    """
    
    BASE_URL = "https://api.gopluslabs.io/api/v1"
    
    def __init__(self, api_key: Optional[str] = None, cache_ttl: int = 300):
        """
        初始化GoPlus客户端
        
        Args:
            api_key: GoPlus API key（可选，免费层不需要）
            cache_ttl: 缓存时间（秒），默认5分钟
        """
        super().__init__(self.BASE_URL, api_key, cache_ttl=cache_ttl)
    
    def _get_default_headers(self) -> Dict[str, str]:
        headers = super()._get_default_headers()
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers
    
    async def get_supported_chains(self) -> List[Dict[str, str]]:
        """
        获取支持的链列表
        
        Returns:
            支持的链列表，包含name和id
        """
        data = await self.get("/supported_chains")
        if data.get("code") != 1:
            raise APIError(f"GoPlus API error: {data.get('message')}")
        return data.get("result", [])
    
    async def check_token_security(
        self,
        chain: str,
        contract_address: str
    ) -> TokenSecurity:
        """
        检查Token安全性
        
        Args:
            chain: 链名（ethereum, bsc, base, arbitrum, polygon, solana等）
            contract_address: Token合约地址
            
        Returns:
            TokenSecurity对象，包含详细安全信息
            
        Raises:
            APIError: API调用失败
            ValueError: 不支持的链
            
        使用示例:
            result = await client.check_token_security("base", "0x...")
            if result.is_honeypot:
                print("警告：蜜罐合约！")
            print(f"风险等级: {result.risk_level.value}")
        """
        chain_id = get_goplus_chain_id(chain)
        if not chain_id:
            raise ValueError(f"Unsupported chain: {chain}. Supported: ethereum, bsc, base, arbitrum, polygon, solana, etc.")
        
        # 标准化地址
        address = contract_address.lower().strip()
        
        data = await self.get(
            f"/token_security/{chain_id}",
            params={"contract_addresses": address}
        )
        
        if data.get("code") != 1:
            raise APIError(f"GoPlus API error: {data.get('message')}")
        
        result = data.get("result", {})
        token_data = result.get(address, {})
        
        if not token_data:
            raise APIError(f"Token not found: {address} on {chain}")
        
        # 解析响应
        security = TokenSecurity(
            address=address,
            chain=chain,
            name=token_data.get("token_name"),
            symbol=token_data.get("token_symbol"),
            is_honeypot=token_data.get("is_honeypot") == "1",
            buy_tax=float(token_data.get("buy_tax") or 0),
            sell_tax=float(token_data.get("sell_tax") or 0),
            is_mintable=token_data.get("is_mintable") == "1",
            can_take_back_ownership=token_data.get("can_take_back_ownership") == "1",
            owner_change_balance=token_data.get("owner_change_balance") == "1",
            hidden_owner=token_data.get("hidden_owner") == "1",
            is_blacklisted=token_data.get("is_blacklisted") == "1",
            transfer_pausable=token_data.get("transfer_pausable") == "1",
            is_proxy=token_data.get("is_proxy") == "1",
            is_open_source=token_data.get("is_open_source") == "1",
            total_supply=token_data.get("total_supply"),
            holder_count=int(token_data.get("holder_count") or 0),
            lp_holder_count=int(token_data.get("lp_holder_count") or 0),
            dex_info=token_data.get("dex", []),
            is_in_cex=token_data.get("is_in_cex", {}).get("listed") == "1",
            cex_list=token_data.get("is_in_cex", {}).get("cex_list", []),
        )
        
        # 计算风险评分
        security.calculate_risk()
        
        return security
    
    async def check_address_security(
        self,
        chain: str,
        address: str
    ) -> Dict[str, Any]:
        """
        检查地址安全性（是否是黑名单地址、钓鱼地址等）
        
        Args:
            chain: 链名
            address: 钱包地址
            
        Returns:
            地址安全信息字典
        """
        chain_id = get_goplus_chain_id(chain)
        if not chain_id:
            raise ValueError(f"Unsupported chain: {chain}")
        
        data = await self.get(
            f"/address_security/{chain_id}",
            params={"address": address.lower()}
        )
        
        if data.get("code") != 1:
            raise APIError(f"GoPlus API error: {data.get('message')}")
        
        return data.get("result", {})
    
    async def check_approval_security(
        self,
        chain: str,
        contract_address: str
    ) -> Dict[str, Any]:
        """
        检查合约授权安全性
        
        Args:
            chain: 链名
            contract_address: 合约地址
            
        Returns:
            授权安全信息
        """
        chain_id = get_goplus_chain_id(chain)
        if not chain_id:
            raise ValueError(f"Unsupported chain: {chain}")
        
        data = await self.get(
            f"/approval_security/{chain_id}",
            params={"contract_addresses": contract_address.lower()}
        )
        
        if data.get("code") != 1:
            raise APIError(f"GoPlus API error: {data.get('message')}")
        
        return data.get("result", {})
