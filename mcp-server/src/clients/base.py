"""
基础HTTP客户端
"""

import httpx
import asyncio
from typing import Any, Dict, Optional
from functools import wraps
import time
import hashlib
import json


class CacheEntry:
    """缓存条目"""
    def __init__(self, data: Any, ttl_seconds: int):
        self.data = data
        self.expires_at = time.time() + ttl_seconds


class SimpleCache:
    """简单内存缓存"""
    
    def __init__(self):
        self._cache: Dict[str, CacheEntry] = {}
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        entry = self._cache.get(key)
        if entry and time.time() < entry.expires_at:
            return entry.data
        if entry:
            del self._cache[key]
        return None
    
    def set(self, key: str, data: Any, ttl_seconds: int) -> None:
        """设置缓存"""
        self._cache[key] = CacheEntry(data, ttl_seconds)
    
    def clear(self) -> None:
        """清除所有缓存"""
        self._cache.clear()
    
    def make_key(self, *args, **kwargs) -> str:
        """生成缓存key"""
        data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True)
        return hashlib.md5(data.encode()).hexdigest()


# 全局缓存实例
cache = SimpleCache()


class APIError(Exception):
    """API错误"""
    def __init__(self, message: str, status_code: Optional[int] = None, response: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class RateLimitError(APIError):
    """速率限制错误"""
    pass


class BaseClient:
    """基础API客户端"""
    
    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        cache_ttl: int = 60
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.cache_ttl = cache_ttl
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """获取或创建HTTP客户端"""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                headers=self._get_default_headers()
            )
        return self._client
    
    def _get_default_headers(self) -> Dict[str, str]:
        """获取默认请求头"""
        return {
            "User-Agent": "ToolFi/0.1.0",
            "Accept": "application/json",
        }
    
    async def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """发送GET请求"""
        url = f"{self.base_url}{path}"
        
        # 检查缓存
        if use_cache:
            cache_key = cache.make_key(url, params)
            cached = cache.get(cache_key)
            if cached is not None:
                return cached
        
        client = await self._get_client()
        
        try:
            response = await client.get(url, params=params)
            
            if response.status_code == 429:
                raise RateLimitError(
                    "Rate limit exceeded",
                    status_code=429,
                    response={"error": "rate_limit"}
                )
            
            response.raise_for_status()
            data = response.json()
            
            # 缓存响应
            if use_cache:
                cache.set(cache_key, data, self.cache_ttl)
            
            return data
            
        except httpx.TimeoutException:
            raise APIError("Request timeout", status_code=None)
        except httpx.HTTPStatusError as e:
            raise APIError(
                f"HTTP error: {e.response.status_code}",
                status_code=e.response.status_code,
                response=e.response.json() if e.response.content else None
            )
    
    async def close(self) -> None:
        """关闭客户端"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
