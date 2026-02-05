'use client';

import { useState } from 'react';

const REGISTRY_ADDRESS = '0x7d6Da6895Be057046E4Cfc19321AF0CF3B30ffb2';
const API_URL = 'https://toolfi.vercel.app';

const tools = [
  {
    id: 0,
    name: 'Crypto Price Oracle',
    description: 'Get real-time cryptocurrency prices, 24h change, market cap.',
    price: '0.001 USDC',
    endpoint: '/api/price?symbol=ethereum',
  },
  {
    id: 1,
    name: 'Wallet Risk Scanner',
    description: 'Analyze any EVM wallet for risk signals and suspicious patterns.',
    price: '0.005 USDC',
    endpoint: '/api/risk?address=0x...',
  },
  {
    id: 2,
    name: 'News Digest',
    description: 'Get AI-summarized crypto news from the last 24 hours.',
    price: '0.002 USDC',
    endpoint: '/api/news?topic=defi',
  },
];

export default function Home() {
  const [demoResponse, setDemoResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tryTool = async (endpoint: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}${endpoint}`);
      const data = await res.json();
      setDemoResponse(JSON.stringify(data, null, 2));
    } catch (e) {
      setDemoResponse('Error fetching data');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Hero */}
      <header className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold mb-4">
          <span className="text-blue-400">Tool</span>Fi
        </h1>
        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
          Agent Tool Marketplace with USDC Payments. <br />
          Discover, publish, and pay for AI agent tools — all on-chain.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <a
            href="https://github.com/Tsubaki414/toolfi"
            target="_blank"
            className="px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-200 transition"
          >
            GitHub
          </a>
          <a
            href={`https://sepolia.basescan.org/address/${REGISTRY_ADDRESS}`}
            target="_blank"
            className="px-6 py-3 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            View Contract
          </a>
          <a
            href={API_URL}
            target="_blank"
            className="px-6 py-3 border border-gray-500 rounded-lg hover:border-white transition"
          >
            API Docs
          </a>
        </div>
      </header>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { step: '1', title: 'Call API', desc: 'Agent calls any tool endpoint' },
            { step: '2', title: 'Get 402', desc: 'Server returns payment instructions' },
            { step: '3', title: 'Pay USDC', desc: 'Agent pays on-chain via contract' },
            { step: '4', title: 'Get Data', desc: 'Retry with tx hash → receive data' },
          ].map((item) => (
            <div key={item.step} className="bg-gray-800 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                {item.step}
              </div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Code example */}
      <section className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-gray-950 rounded-xl p-6 overflow-x-auto">
          <pre className="text-sm text-gray-300">
{`// 1. Call tool → get 402 Payment Required
GET /api/price?symbol=ETH
→ { status: 402, payment: { toolId: 0, price: 1000, contract: "0x7d6..." } }

// 2. Pay USDC on-chain
usdc.approve(registry, 1000)
registry.payForCall(0)  // toolId = 0

// 3. Retry with payment proof
GET /api/price?symbol=ETH
Header: X-Payment-Tx: 0x<your_tx_hash>
→ { data: { token: "ETH", priceUsd: "3245.67", ... } }`}
          </pre>
        </div>
      </section>

      {/* Demo Tools */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">Demo Tools</h2>
        <p className="text-gray-400 text-center mb-12">
          Try calling a tool — you&apos;ll see the 402 response with payment instructions
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <div key={tool.id} className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs bg-blue-600 px-2 py-1 rounded">Tool #{tool.id}</span>
                <span className="text-green-400 font-mono text-sm">{tool.price}</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">{tool.name}</h3>
              <p className="text-gray-400 text-sm mb-4">{tool.description}</p>
              <code className="text-xs text-gray-500 block mb-4 break-all">{tool.endpoint}</code>
              <button
                onClick={() => tryTool(tool.endpoint)}
                className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
              >
                Try it →
              </button>
            </div>
          ))}
        </div>

        {/* Demo response */}
        {demoResponse && (
          <div className="mt-8 bg-gray-950 rounded-xl p-6 overflow-x-auto">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-400">API Response (402 Payment Required)</span>
              <button
                onClick={() => setDemoResponse(null)}
                className="text-gray-500 hover:text-white"
              >
                ✕
              </button>
            </div>
            <pre className="text-sm text-green-400">{loading ? 'Loading...' : demoResponse}</pre>
          </div>
        )}
      </section>

      {/* Why USDC */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Why USDC?</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { title: 'Stable', desc: 'No price volatility — tool creators know exactly what they earn' },
            { title: 'Programmable', desc: 'Smart contract escrow handles payment splitting automatically' },
            { title: 'Widely Held', desc: 'The most used stablecoin, already in agent wallets' },
            { title: 'Base Native', desc: 'Fast, cheap L2 transactions keep per-call costs viable' },
          ].map((item) => (
            <div key={item.title} className="bg-gray-800 rounded-xl p-6">
              <h3 className="font-semibold mb-2 text-blue-400">{item.title}</h3>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Links */}
      <section className="max-w-5xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-bold mb-8">Get Started</h2>
        <div className="bg-gray-800 rounded-xl p-8 inline-block text-left">
          <div className="space-y-4 font-mono text-sm">
            <p><span className="text-gray-500">Contract:</span> <a href={`https://sepolia.basescan.org/address/${REGISTRY_ADDRESS}`} className="text-blue-400 hover:underline" target="_blank">{REGISTRY_ADDRESS}</a></p>
            <p><span className="text-gray-500">Chain:</span> Base Sepolia (84532)</p>
            <p><span className="text-gray-500">USDC:</span> 0x036CbD53842c5426634e7929541eC2318f3dCF7e</p>
            <p><span className="text-gray-500">API:</span> <a href={API_URL} className="text-blue-400 hover:underline" target="_blank">{API_URL}</a></p>
          </div>
        </div>
        <p className="mt-8 text-gray-400">
          Get testnet USDC from{' '}
          <a href="https://faucet.circle.com/" target="_blank" className="text-blue-400 hover:underline">
            Circle&apos;s Faucet
          </a>
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 text-center text-gray-500 text-sm">
        Built for the{' '}
        <a href="https://moltbook.com/m/usdc" target="_blank" className="text-blue-400 hover:underline">
          USDC Hackathon
        </a>{' '}
        on Moltbook
      </footer>
    </div>
  );
}
