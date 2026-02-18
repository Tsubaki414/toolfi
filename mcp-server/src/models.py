"""
数据模型定义
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum


class RiskLevel(Enum):
    """风险等级"""
    SAFE = "safe"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class TokenSecurity:
    """Token安全信息"""
    address: str
    chain: str
    name: Optional[str] = None
    symbol: Optional[str] = None
    
    # 核心风险指标
    is_honeypot: bool = False
    buy_tax: float = 0.0
    sell_tax: float = 0.0
    is_mintable: bool = False
    can_take_back_ownership: bool = False
    owner_change_balance: bool = False
    hidden_owner: bool = False
    is_blacklisted: bool = False
    transfer_pausable: bool = False
    is_proxy: bool = False
    is_open_source: bool = True
    
    # 流动性信息
    total_supply: Optional[str] = None
    holder_count: Optional[int] = None
    lp_holder_count: Optional[int] = None
    
    # DEX信息
    dex_info: List[Dict[str, Any]] = field(default_factory=list)
    
    # CEX上架
    is_in_cex: bool = False
    cex_list: List[str] = field(default_factory=list)
    
    # 风险评分（0-100，越高越危险）
    risk_score: int = 0
    risk_level: RiskLevel = RiskLevel.SAFE
    risk_factors: List[str] = field(default_factory=list)
    
    def calculate_risk(self) -> None:
        """计算风险评分"""
        score = 0
        factors = []
        
        if self.is_honeypot:
            score += 100
            factors.append("🚨 蜜罐合约 - 无法卖出!")
        
        if self.buy_tax > 0.1:
            score += min(30, int(self.buy_tax * 100))
            factors.append(f"⚠️ 买入税: {self.buy_tax * 100:.1f}%")
        
        if self.sell_tax > 0.1:
            score += min(30, int(self.sell_tax * 100))
            factors.append(f"⚠️ 卖出税: {self.sell_tax * 100:.1f}%")
        
        if self.is_mintable:
            score += 20
            factors.append("⚠️ 可增发")
        
        if self.can_take_back_ownership:
            score += 25
            factors.append("🚨 可收回所有权")
        
        if self.owner_change_balance:
            score += 30
            factors.append("🚨 Owner可修改余额")
        
        if self.hidden_owner:
            score += 15
            factors.append("⚠️ 隐藏的Owner")
        
        if self.is_blacklisted:
            score += 10
            factors.append("⚠️ 有黑名单功能")
        
        if self.transfer_pausable:
            score += 15
            factors.append("⚠️ 可暂停转账")
        
        if not self.is_open_source:
            score += 20
            factors.append("⚠️ 代码未开源")
        
        if self.is_proxy:
            score += 10
            factors.append("ℹ️ 代理合约")
        
        self.risk_score = min(100, score)
        self.risk_factors = factors
        
        if score >= 80:
            self.risk_level = RiskLevel.CRITICAL
        elif score >= 50:
            self.risk_level = RiskLevel.HIGH
        elif score >= 25:
            self.risk_level = RiskLevel.MEDIUM
        elif score > 0:
            self.risk_level = RiskLevel.LOW
        else:
            self.risk_level = RiskLevel.SAFE


@dataclass
class TokenPrice:
    """Token价格信息"""
    address: str
    chain: str
    price_usd: float
    change_24h: Optional[float] = None
    market_cap: Optional[float] = None
    volume_24h: Optional[float] = None
    last_updated: Optional[str] = None


@dataclass
class DefiPool:
    """DeFi池信息"""
    pool_id: str
    chain: str
    project: str
    symbol: str
    tvl_usd: float
    apy: float
    apy_base: Optional[float] = None
    apy_reward: Optional[float] = None
    reward_tokens: List[str] = field(default_factory=list)
    stablecoin: bool = False
    il_risk: str = "unknown"
    underlying_tokens: List[str] = field(default_factory=list)


@dataclass
class BridgeQuote:
    """跨链桥报价"""
    from_chain: str
    to_chain: str
    from_token: str
    to_token: str
    from_amount: str
    to_amount: str
    to_amount_usd: Optional[float] = None
    gas_cost_usd: Optional[float] = None
    execution_time_seconds: Optional[int] = None
    bridge_name: str = ""
    steps: List[Dict[str, Any]] = field(default_factory=list)
