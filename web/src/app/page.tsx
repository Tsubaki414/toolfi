'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { REGISTRY_ADDRESS, USDC_ADDRESS, REGISTRY_ABI, API_URL } from './contracts';

interface Tool {
  id: bigint;
  creator: string;
  name: string;
  endpoint: string;
  description: string;
  pricePerCall: bigint;
  totalCalls: bigint;
  totalEarned: bigint;
  active: boolean;
  category: string;
}

const categories = [
  { id: 'all', name: 'All Tools', icon: '🔧' },
  { id: 'blockchain', name: 'Blockchain', icon: '⛓️' },
  { id: 'data', name: 'Data & Analytics', icon: '📊' },
  { id: 'ai', name: 'AI & ML', icon: '🤖' },
  { id: 'utility', name: 'Utility', icon: '⚡' },
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showRegister, setShowRegister] = useState(false);
  const [newTool, setNewTool] = useState({ name: '', endpoint: '', description: '', price: '', category: 'utility' });
  const [demoResponse, setDemoResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tippingToolId, setTippingToolId] = useState<bigint | null>(null);
  const [tipAmount, setTipAmount] = useState('');
  const [uploadedTools, setUploadedTools] = useState<Tool[]>([]);
  const [registerMode, setRegisterMode] = useState<'api' | 'onchain'>('api');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Read user's earnings balance
  const { data: userBalance } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'balances',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Write contracts
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Demo tools with categories
  const demoTools: Tool[] = [
    {
      id: 0n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'Crypto Price Oracle',
      endpoint: `${API_URL}/api/price`,
      description: 'Real-time cryptocurrency prices with 24h change, market cap, and liquidity data.',
      pricePerCall: 1000n,
      totalCalls: 1n,
      totalEarned: 1000n,
      active: true,
      category: 'data',
    },
    {
      id: 1n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'Wallet Risk Scanner',
      endpoint: `${API_URL}/api/risk`,
      description: 'Analyze any EVM wallet for risk signals, transaction patterns, and suspicious activity.',
      pricePerCall: 5000n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
      category: 'blockchain',
    },
    {
      id: 2n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'News Digest',
      endpoint: `${API_URL}/api/news`,
      description: 'AI-curated crypto news with summaries from top sources in the last 24 hours.',
      pricePerCall: 2000n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
      category: 'data',
    },
    {
      id: 3n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'Rug Pull Scanner',
      endpoint: `${API_URL}/api/rugcheck?token=0x6982508145454Ce325dDbE47a25d4ec3d2311933&chain=1`,
      description: 'Detect honeypots, hidden owners, and rug pull risks. Powered by GoPlus Security API.',
      pricePerCall: 3000n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
      category: 'blockchain',
    },
    {
      id: 4n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'Bridge Router',
      endpoint: `${API_URL}/api/bridge?fromChain=1&toChain=42161&fromToken=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&toToken=0xaf88d065e77c8cC2239327C5EDb3A432268e5831&amount=1000000000`,
      description: 'Find optimal cross-chain bridge routes. Aggregates Li.Fi, Stargate, Hop, and more.',
      pricePerCall: 2000n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
      category: 'blockchain',
    },
    {
      id: 5n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'DeFi Yield Finder',
      endpoint: `${API_URL}/api/yields?chain=ethereum&minApy=5&minTvl=1000000`,
      description: 'Find top DeFi yields across all chains. Filter by APY, TVL, stablecoin pools. Powered by DefiLlama.',
      pricePerCall: 2000n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
      category: 'data',
    },
    {
      id: 6n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'Swap Router',
      endpoint: `${API_URL}/api/swap?chain=1&fromToken=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&toToken=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2&amount=1000000000`,
      description: 'Find optimal swap routes across DEXs. Aggregates Uniswap, Sushiswap, Curve and more via Li.Fi.',
      pricePerCall: 2000n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
      category: 'blockchain',
    },
    {
      id: 7n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'Trending Coins',
      endpoint: `${API_URL}/api/trending`,
      description: 'Get top trending cryptocurrencies right now. Real-time data from CoinGecko.',
      pricePerCall: 1000n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
      category: 'data',
    },
    {
      id: 8n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'Protocol TVL',
      endpoint: `${API_URL}/api/tvl?protocol=aave`,
      description: 'Get Total Value Locked data for DeFi protocols. Track TVL changes and compare protocols.',
      pricePerCall: 1000n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
      category: 'data',
    },
    {
      id: 9n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'Gas Tracker',
      endpoint: `${API_URL}/api/gas?chain=1`,
      description: 'Real-time gas prices for Ethereum, Polygon, Arbitrum. Get safe, standard, and fast estimates.',
      pricePerCall: 500n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
      category: 'utility',
    },
  ];

  // Combine builtin + uploaded tools
  const allTools = [...demoTools, ...uploadedTools];
  const filteredTools = selectedCategory === 'all' 
    ? allTools 
    : allTools.filter(t => t.category === selectedCategory);

  // Fetch uploaded tools on mount
  const fetchUploadedTools = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tools`);
      const data = await res.json();
      if (data.tools) {
        const tools: Tool[] = data.tools.map((t: any) => ({
          id: BigInt(t.id),
          creator: t.creator || 'anonymous',
          name: t.name,
          endpoint: t.endpoint,
          description: t.description || '',
          pricePerCall: BigInt(t.pricePerCall || 1000),
          totalCalls: BigInt(t.totalCalls || 0),
          totalEarned: 0n,
          active: t.active ?? true,
          category: t.category || 'custom',
        }));
        setUploadedTools(tools);
      }
    } catch (e) {
      console.error('Failed to fetch uploaded tools:', e);
    }
  };

  // Load uploaded tools on component mount
  useEffect(() => {
    fetchUploadedTools();
  }, []);

  // Handle API-based upload (no blockchain transaction)
  const handleApiUpload = async () => {
    if (!newTool.name || !newTool.endpoint) {
      alert('Name and endpoint are required');
      return;
    }
    
    setUploadStatus('Uploading...');
    try {
      const priceInMicro = newTool.price ? parseFloat(newTool.price) * 1e6 : 1000;
      const res = await fetch(`${API_URL}/api/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTool.name,
          endpoint: newTool.endpoint,
          description: newTool.description,
          pricePerCall: Math.floor(priceInMicro),
          category: newTool.category,
          creator: address || 'anonymous',
        }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setUploadStatus('✓ Tool uploaded successfully!');
        setNewTool({ name: '', endpoint: '', description: '', price: '', category: 'utility' });
        fetchUploadedTools(); // Refresh the list
        setTimeout(() => setUploadStatus(null), 3000);
      } else {
        setUploadStatus(`Error: ${data.error || 'Upload failed'}`);
      }
    } catch (e) {
      setUploadStatus('Error: Network error');
    }
  };

  // Handle on-chain registration
  const handleRegister = async () => {
    if (registerMode === 'api') {
      return handleApiUpload();
    }
    
    // On-chain registration
    if (!newTool.name || !newTool.endpoint || !newTool.description || !newTool.price) {
      alert('Please fill all fields');
      return;
    }
    const priceInMicro = parseUnits(newTool.price, 6);
    writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'registerTool',
      args: [newTool.name, newTool.endpoint, newTool.description, priceInMicro],
    });
  };

  const handleWithdraw = () => {
    writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'withdraw',
    });
  };

  const handleTip = async () => {
    if (!tipAmount || !tippingToolId) return;
    const amountInMicro = parseUnits(tipAmount, 6);
    writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'tip',
      args: [tippingToolId, amountInMicro],
    });
    setTippingToolId(null);
    setTipAmount('');
  };

  const tryTool = async (endpoint: string) => {
    setLoading(true);
    try {
      const url = endpoint.includes('?') ? endpoint : `${endpoint}?symbol=ethereum`;
      const res = await fetch(url);
      const data = await res.json();
      setDemoResponse(JSON.stringify(data, null, 2));
    } catch (e) {
      setDemoResponse('Error fetching data');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0d1117] to-[#0a0a0f]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-cyan-900/30">
          <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold">
              <span className="text-cyan-400">Tool</span>
              <span className="text-white">Drop</span>
              <span className="text-cyan-400/60 text-sm ml-2">⬡</span>
            </h1>
            <div className="flex items-center gap-4">
              <a href="https://github.com/Tsubaki414/toolfi" target="_blank" className="text-gray-400 hover:text-cyan-400 text-sm transition">
                GitHub
              </a>
              <a href={API_URL} target="_blank" className="text-gray-400 hover:text-cyan-400 text-sm transition">
                API
              </a>
              <ConnectButton />
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 py-20 text-center">
          <div className="inline-block mb-6 px-4 py-1 bg-cyan-400/10 border border-cyan-400/30 rounded-full text-cyan-400 text-sm">
            The API marketplace for AI agents
          </div>
          <h2 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="text-white">APIs that </span>
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              pay themselves
            </span>
          </h2>
          <p className="text-xl text-gray-400 mb-4 max-w-2xl mx-auto">
            Agents discover tools. Agents pay USDC. Every call settles on-chain.
          </p>
          <p className="text-gray-500 mb-8 max-w-xl mx-auto">
            No API keys. No accounts. No humans in the loop.
          </p>
          
          {/* Stats */}
          <div className="flex justify-center gap-8 mb-10">
            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-400">{allTools.length}</div>
              <div className="text-sm text-gray-500">Tools Live</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-400">x402</div>
              <div className="text-sm text-gray-500">Protocol</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-400">Base</div>
              <div className="text-sm text-gray-500">Network</div>
            </div>
          </div>
          <div className="flex gap-4 justify-center">
            {isConnected ? (
              <button
                onClick={() => setShowRegister(!showRegister)}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 font-semibold rounded-lg hover:from-cyan-400 hover:to-blue-400 transition shadow-lg shadow-cyan-500/25"
              >
                {showRegister ? '✕ Close' : '+ Register Your Tool'}
              </button>
            ) : (
              <div className="px-6 py-3 border border-cyan-500/50 rounded-lg text-cyan-400">
                Connect wallet to register tools
              </div>
            )}
          </div>
        </section>

        {/* Register Tool Form */}
        {showRegister && isConnected && (
          <section className="max-w-2xl mx-auto px-6 pb-12">
            <div className="bg-gray-900/50 backdrop-blur border border-cyan-900/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold mb-4 text-cyan-400">Register Your Tool</h3>
              
              {/* Mode Selector */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setRegisterMode('api')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                    registerMode === 'api'
                      ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
                      : 'bg-black/30 border border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  ⚡ Quick Upload
                  <span className="block text-xs opacity-70">No gas fees</span>
                </button>
                <button
                  onClick={() => setRegisterMode('onchain')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                    registerMode === 'onchain'
                      ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
                      : 'bg-black/30 border border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  ⛓️ On-Chain
                  <span className="block text-xs opacity-70">Permanent record</span>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tool Name</label>
                  <input
                    type="text"
                    value={newTool.name}
                    onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                    className="w-full px-4 py-2 bg-black/50 rounded-lg border border-cyan-900/50 focus:border-cyan-500 outline-none transition"
                    placeholder="e.g. Weather Oracle"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select
                    value={newTool.category}
                    onChange={(e) => setNewTool({ ...newTool, category: e.target.value })}
                    className="w-full px-4 py-2 bg-black/50 rounded-lg border border-cyan-900/50 focus:border-cyan-500 outline-none transition"
                  >
                    {categories.filter(c => c.id !== 'all').map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">API Endpoint</label>
                  <input
                    type="text"
                    value={newTool.endpoint}
                    onChange={(e) => setNewTool({ ...newTool, endpoint: e.target.value })}
                    className="w-full px-4 py-2 bg-black/50 rounded-lg border border-cyan-900/50 focus:border-cyan-500 outline-none transition"
                    placeholder="https://api.example.com/tool"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    value={newTool.description}
                    onChange={(e) => setNewTool({ ...newTool, description: e.target.value })}
                    className="w-full px-4 py-2 bg-black/50 rounded-lg border border-cyan-900/50 focus:border-cyan-500 outline-none h-24 transition"
                    placeholder="What does your tool do?"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Price per Call (USDC)</label>
                  <input
                    type="text"
                    value={newTool.price}
                    onChange={(e) => setNewTool({ ...newTool, price: e.target.value })}
                    className="w-full px-4 py-2 bg-black/50 rounded-lg border border-cyan-900/50 focus:border-cyan-500 outline-none transition"
                    placeholder="0.001"
                  />
                </div>
                <button
                  onClick={handleRegister}
                  disabled={isPending || isConfirming || uploadStatus === 'Uploading...'}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 font-semibold rounded-lg hover:from-cyan-400 hover:to-blue-400 transition disabled:opacity-50 shadow-lg shadow-cyan-500/25"
                >
                  {registerMode === 'api' 
                    ? (uploadStatus === 'Uploading...' ? 'Uploading...' : '⚡ Upload Tool')
                    : (isPending ? 'Confirm in Wallet...' : isConfirming ? 'Registering...' : '⛓️ Register On-Chain')
                  }
                </button>
                {uploadStatus && (
                  <p className={`text-sm text-center ${uploadStatus.startsWith('✓') ? 'text-cyan-400' : uploadStatus.startsWith('Error') ? 'text-red-400' : 'text-gray-400'}`}>
                    {uploadStatus}
                  </p>
                )}
                {isSuccess && (
                  <p className="text-cyan-400 text-sm text-center">✓ Tool registered successfully!</p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* User Balance */}
        {isConnected && userBalance && userBalance > 0n && (
          <section className="max-w-6xl mx-auto px-6 pb-8">
            <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-sm text-cyan-400">Your Earnings</p>
                <p className="text-2xl font-bold">{formatUnits(userBalance, 6)} USDC</p>
              </div>
              <button
                onClick={handleWithdraw}
                disabled={isPending || isConfirming}
                className="px-4 py-2 bg-cyan-500 rounded-lg hover:bg-cyan-400 transition font-semibold"
              >
                Withdraw
              </button>
            </div>
          </section>
        )}

        {/* Category Filter */}
        <section className="max-w-6xl mx-auto px-6 pb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </section>

        {/* Tools Grid */}
        <section className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold">
              {selectedCategory === 'all' ? 'All Tools' : categories.find(c => c.id === selectedCategory)?.name}
            </h3>
            <span className="text-gray-500">{filteredTools.length} tools</span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTools.map((tool) => (
              <div key={Number(tool.id)} className="group bg-gray-900/50 backdrop-blur border border-gray-800 hover:border-cyan-500/50 rounded-2xl p-6 flex flex-col transition">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded-full">
                    {categories.find(c => c.id === tool.category)?.icon} {tool.category}
                  </span>
                  <span className="text-cyan-400 font-mono font-bold">{formatUnits(tool.pricePerCall, 6)} USDC</span>
                </div>
                <h4 className="text-lg font-semibold mb-2 group-hover:text-cyan-400 transition">{tool.name}</h4>
                <p className="text-gray-400 text-sm mb-4 flex-grow">{tool.description}</p>
                {tool.totalCalls > 0n && (
                  <div className="text-xs text-gray-500 mb-4">
                    {Number(tool.totalCalls)} calls · {formatUnits(tool.totalEarned, 6)} USDC earned
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => tryTool(tool.endpoint)}
                    className="flex-1 py-2 bg-gray-800 hover:bg-cyan-500/20 hover:text-cyan-400 rounded-lg text-sm transition border border-transparent hover:border-cyan-500/50"
                  >
                    Try It →
                  </button>
                  {isConnected && (
                    <button
                      onClick={() => setTippingToolId(tool.id)}
                      className="px-3 py-2 bg-gray-800 hover:bg-pink-500/20 hover:text-pink-400 rounded-lg text-sm transition border border-transparent hover:border-pink-500/50"
                      title="Tip this tool"
                    >
                      💝
                    </button>
                  )}
                  <a
                    href={`https://sepolia.basescan.org/address/${REGISTRY_ADDRESS}`}
                    target="_blank"
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
                  >
                    ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tip Modal */}
        {tippingToolId !== null && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-cyan-500/30 rounded-2xl p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-cyan-400">💝 Tip Tool Creator</h3>
                <button onClick={() => setTippingToolId(null)} className="text-gray-500 hover:text-white">✕</button>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Show appreciation for <span className="text-white font-semibold">{demoTools.find(t => t.id === tippingToolId)?.name}</span>
              </p>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">Tip Amount (USDC)</label>
                <input
                  type="text"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="w-full px-4 py-2 bg-black/50 rounded-lg border border-cyan-900/50 focus:border-cyan-500 outline-none transition"
                  placeholder="0.01"
                />
              </div>
              <div className="flex gap-2 mb-4">
                {['0.01', '0.05', '0.10'].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setTipAmount(amt)}
                    className="flex-1 py-2 bg-gray-800 hover:bg-cyan-500/20 rounded-lg text-sm transition"
                  >
                    {amt} USDC
                  </button>
                ))}
              </div>
              <button
                onClick={handleTip}
                disabled={!tipAmount || isPending || isConfirming}
                className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-500 font-semibold rounded-lg hover:from-pink-400 hover:to-purple-400 transition disabled:opacity-50"
              >
                {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Sending Tip...' : `Tip ${tipAmount || '0'} USDC`}
              </button>
            </div>
          </div>
        )}

        {/* Demo response */}
        {demoResponse && (
          <section className="max-w-6xl mx-auto px-6 py-8">
            <div className="bg-black/50 backdrop-blur border border-cyan-900/50 rounded-2xl p-6 overflow-x-auto">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-cyan-400">API Response — 402 Payment Required</span>
                <button onClick={() => setDemoResponse(null)} className="text-gray-500 hover:text-white transition">✕</button>
              </div>
              <pre className="text-sm text-cyan-300 whitespace-pre-wrap font-mono">{loading ? 'Loading...' : demoResponse}</pre>
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="max-w-6xl mx-auto px-6 py-16 border-t border-gray-800/50">
          <h3 className="text-2xl font-bold text-center mb-8">How It Works</h3>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { step: '1', title: 'Discover', desc: 'Browse tools by category', icon: '🔍' },
              { step: '2', title: 'Call API', desc: 'Get 402 + payment info', icon: '📡' },
              { step: '3', title: 'Pay USDC', desc: 'On-chain via contract', icon: '💰' },
              { step: '4', title: 'Get Data', desc: 'Retry with tx hash', icon: '✨' },
            ].map((item) => (
              <div key={item.step} className="bg-gray-900/30 border border-gray-800/50 rounded-xl p-4 text-center hover:border-cyan-500/30 transition">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h4 className="font-semibold mb-1 text-cyan-400">{item.title}</h4>
                <p className="text-gray-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-6 py-16 text-center">
          <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 rounded-2xl p-12">
            <h3 className="text-3xl font-bold mb-4">List Your API</h3>
            <p className="text-gray-400 mb-6 max-w-xl mx-auto">
              Got a useful API? Register it on ToolDrop. Set your price. Get paid in USDC every time an agent calls it.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a
                href="https://faucet.circle.com/"
                target="_blank"
                className="px-6 py-3 bg-cyan-500 font-semibold rounded-lg hover:bg-cyan-400 transition"
              >
                Start Building →
              </a>
              <a
                href="https://github.com/Tsubaki414/toolfi#readme"
                target="_blank"
                className="px-6 py-3 border border-cyan-500/50 text-cyan-400 rounded-lg hover:bg-cyan-500/10 transition"
              >
                Read the Docs
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-800/50 py-8">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
            <div>
              ToolDrop — The API marketplace for AI agents
            </div>
            <div className="flex gap-6">
              <a href={`https://sepolia.basescan.org/address/${REGISTRY_ADDRESS}`} target="_blank" className="hover:text-cyan-400 transition">
                Contract
              </a>
              <a href="https://github.com/Tsubaki414/toolfi" target="_blank" className="hover:text-cyan-400 transition">
                GitHub
              </a>
              <a href="https://x.com/snowmaker3575" target="_blank" className="hover:text-cyan-400 transition">
                Twitter
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
