/**
 * Chain3DPage - Standalone 3D blockchain visualization page.
 * Route: /chain-3d
 * Pass ?rpc=http://... to connect to a specific node, or uses localStorage custom_rpc / localhost.
 * Optional L2 RPC for Layer 2 chain (Optimism, Arbitrum, Base, etc.).
 */
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ethers } from 'ethers';
import { Blockchain3DView } from '../components/Blockchain3DView';

const DEFAULT_RPC = 'http://localhost:8545';

function createProvider(url) {
  if (!url || !url.trim()) return null;
  const u = url.trim();
  const isWs = /^wss?:\/\//i.test(u);
  return isWs ? new ethers.WebSocketProvider(u) : new ethers.JsonRpcProvider(u);
}

export default function Chain3DPage() {
  const [searchParams] = useSearchParams();
  const rpcParam = searchParams.get('rpc') || '';
  const rpcFromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem('custom_rpc') : null;
  const rpcUrl = (rpcParam || rpcFromStorage || DEFAULT_RPC).trim() || DEFAULT_RPC;

  const [provider, setProvider] = useState(null);
  const [l2Provider, setL2Provider] = useState(null);
  const [l2RpcInput, setL2RpcInput] = useState('');
  const [providerError, setProviderError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setProviderError(null);
    const p = createProvider(rpcUrl);
    if (!p) return;
    p.getBlockNumber()
      .then(() => {
        if (!cancelled) setProvider(p);
      })
      .catch((err) => {
        if (!cancelled) {
          setProviderError(err.message || 'Failed to connect');
          setProvider(null);
        }
      });
    return () => {
      cancelled = true;
      if (p?.destroy) p.destroy();
    };
  }, [rpcUrl]);

  useEffect(() => {
    if (!l2RpcInput.trim()) {
      setL2Provider(null);
      return;
    }
    let cancelled = false;
    const p = createProvider(l2RpcInput);
    if (!p) {
      setL2Provider(null);
      return;
    }
    p.getBlockNumber()
      .then(() => {
        if (!cancelled) setL2Provider(p);
      })
      .catch(() => {
        if (!cancelled) setL2Provider(null);
      });
    return () => {
      cancelled = true;
      if (p?.destroy) p.destroy();
    };
  }, [l2RpcInput]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid rgba(34, 255, 136, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link
            to="/"
            style={{
              color: '#22ff88',
              textDecoration: 'none',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
            }}
          >
            ← Back
          </Link>
          <span
            style={{
              color: '#22ff88',
              fontFamily: 'monospace',
              fontWeight: 600,
              fontSize: '1.1rem',
            }}
          >
            3D Chain Explorer
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.8rem' }}>
            L1: {rpcUrl}
          </div>
          <input
            placeholder="L2 RPC (optional)"
            value={l2RpcInput}
            onChange={(e) => setL2RpcInput(e.target.value)}
            style={{
              padding: '0.35rem 0.5rem',
              width: 180,
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid #475569',
              borderRadius: '0.25rem',
              color: '#e2e8f0',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
            }}
          />
        </div>
      </header>

      <main
        style={{
          flex: 1,
          padding: '1rem',
          overflow: 'auto',
          minHeight: 0,
        }}
      >
        {providerError && !provider ? (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#f87171',
              background: 'rgba(248, 113, 113, 0.1)',
              border: '1px solid rgba(248, 113, 113, 0.3)',
              borderRadius: '0.5rem',
              maxWidth: 500,
              margin: '2rem auto',
            }}
          >
            <div style={{ marginBottom: '1rem' }}>Could not connect to chain</div>
            <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1rem' }}>
              {providerError}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Ensure Hardhat is running: <code style={{ color: '#22ff88' }}>npx hardhat node</code>
            </div>
          </div>
        ) : !provider ? (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#22ff88',
              fontFamily: 'monospace',
            }}
          >
            Connecting to chain...
          </div>
        ) : (
          <div style={{ height: '100%', minHeight: 450 }}>
            <Blockchain3DView provider={provider} rpcUrl={rpcUrl} l2Provider={l2Provider} />
          </div>
        )}
      </main>
    </div>
  );
}
