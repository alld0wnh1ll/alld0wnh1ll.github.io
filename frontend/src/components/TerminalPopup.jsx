/**
 * TerminalPopup - Full PTY terminal in a modal overlay (Termux-style)
 * Connects to the Lab Terminal server (node-pty + WebSocket) for real shell access.
 * Retries with backoff and tries multiple ports (3002, 3003, 3004) for robustness.
 */

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

// Ports to try in order (from env or default)
const TERMINAL_PORTS = (import.meta.env.VITE_TERMINAL_PORTS || '3002,3003,3004')
  .split(',')
  .map(s => parseInt(s.trim(), 10))
  .filter(p => !isNaN(p) && p > 0);
if (TERMINAL_PORTS.length === 0) TERMINAL_PORTS.push(3002);

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

function getWsUrls() {
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:5173';
  // Prefer same-origin proxy (no extra ports, works behind firewalls)
  const proxyUrl = `${protocol}//${host}/ws/terminal`;
  const directUrls = TERMINAL_PORTS.map(p => {
    const h = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `${protocol}//${h}:${p}`;
  });
  return [proxyUrl, ...directUrls];
}

export default function TerminalPopup({ open, onClose, rpcUrl = '' }) {
  const containerRef = useRef(null);
  const terminalRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected | error
  const [errorMsg, setErrorMsg] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!open || !containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#94a3b8',
        cursorAccent: '#0f172a',
        selectionBackground: 'rgba(99, 102, 241, 0.4)',
        black: '#1e293b',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#a78bfa',
        cyan: '#22d3ee',
        white: '#f8fafc',
        brightBlack: '#64748b',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#c4b5fd',
        brightCyan: '#67e8f9',
        brightWhite: '#ffffff',
      },
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace',
      fontSize: 14,
      cursorBlink: true,
      allowProposedApi: false,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    setStatus('connecting');
    setErrorMsg('');

    const urls = getWsUrls();
    let cancelled = false;
    let connectedWs = null;

    const tryConnect = (urlIndex, retryCount) => {
      if (cancelled) return;
      const url = urls[urlIndex];
      const label = urlIndex === 0 ? 'proxy' : `port ${TERMINAL_PORTS[urlIndex - 1]}`;
      setErrorMsg(`Connecting to ${label}${retryCount > 0 ? ` (retry ${retryCount + 1}/${MAX_RETRIES})` : ''}...`);
      const sock = new WebSocket(url);
      wsRef.current = sock;
      let didFail = false;

      const tryNext = () => {
        if (didFail || cancelled) return;
        didFail = true;
        try { sock.close(); } catch (_) {}
        if (cancelled) return;
        if (urlIndex + 1 < urls.length) {
          tryConnect(urlIndex + 1, retryCount);
        } else if (retryCount + 1 < MAX_RETRIES) {
          const delay = RETRY_DELAYS_MS[retryCount];
          setTimeout(() => tryConnect(0, retryCount + 1), delay);
        } else {
          setStatus('error');
          setErrorMsg('Cannot connect to terminal. Run: npm run terminal (in project root). If using Docker, ensure the container started the terminal server.');
        }
      };

      sock.onopen = () => {
        if (cancelled) { sock.close(); return; }
        connectedWs = sock;
        setStatus('connected');
        setErrorMsg('');
        fitAddon.fit();
        const { cols, rows } = term;
        sock.send(`resize:${cols}:${rows}`);
        term.writeln('\x1b[32m✓ Lab Terminal — starting Hardhat console (JavaScript REPL)\x1b[0m');
        term.writeln('\x1b[90mExample scripts are JavaScript — they run in Hardhat, not PowerShell.\x1b[0m');
        term.writeln('');
        const isWin = typeof navigator !== 'undefined' && /Win/i.test(navigator.platform || navigator.userAgent || '');
        const useInstructor = rpcUrl && rpcUrl.trim() && !/127\.0\.0\.1|localhost/.test(rpcUrl.trim());
        const network = useInstructor ? 'instructor' : 'localhost';
        const sendBoot = () => {
          if (sock.readyState !== WebSocket.OPEN || cancelled) return;
          if (rpcUrl && rpcUrl.trim()) {
            const safe = rpcUrl.trim().replace(/"/g, '\\"');
            const cmd = isWin
              ? `$env:RPC_URL="${safe}"\r\n`
              : `export RPC_URL="${safe}"\r\n`;
            sock.send(cmd);
          }
          sock.send(`npx hardhat console --network ${network}\r\n`);
        };
        setTimeout(sendBoot, 400);
      };

      sock.onmessage = (ev) => {
        term.write(ev.data);
      };

      sock.onclose = (ev) => {
        if (sock === wsRef.current && ev.code !== 1000) {
          tryNext();
        } else if (sock === wsRef.current) {
          setStatus('disconnected');
          term.writeln('\r\n\x1b[33m[Connection closed]\x1b[0m');
        }
      };

      sock.onerror = () => {
        if (sock.readyState !== WebSocket.OPEN) {
          tryNext();
        }
      };
    };

    try {
      tryConnect(0, 0);
    } catch (e) {
      setStatus('error');
      setErrorMsg(e.message || 'WebSocket failed');
    }

    term.onData((data) => {
      const w = wsRef.current;
      if (w?.readyState === WebSocket.OPEN) w.send(data);
    });

    const sendResize = () => {
      const w = wsRef.current;
      if (w?.readyState === WebSocket.OPEN && fitAddon) {
        const { cols, rows } = term;
        w.send(`resize:${cols}:${rows}`);
      }
    };
    fitAddon.fit();
    sendResize();

    const ro = new ResizeObserver(() => {
      fitAddon.fit();
      sendResize();
    });
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      cancelled = true;
      ro.disconnect();
      const w = wsRef.current;
      if (w) w.close();
      wsRef.current = null;
      terminalRef.current = null;
      fitAddonRef.current = null;
      term.dispose();
    };
  }, [open, retryKey, rpcUrl]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 1rem',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderBottom: '1px solid #334155',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: '#a78bfa', fontWeight: 'bold', fontSize: '0.95rem' }}>
            🖥️ Lab Terminal
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '0.25rem',
              background:
                status === 'connected'
                  ? 'rgba(34, 197, 94, 0.2)'
                  : status === 'connecting'
                  ? 'rgba(251, 191, 36, 0.2)'
                  : status === 'error'
                  ? 'rgba(248, 113, 113, 0.2)'
                  : 'rgba(100, 116, 139, 0.2)',
              color:
                status === 'connected'
                  ? '#4ade80'
                  : status === 'connecting'
                  ? '#fbbf24'
                  : status === 'error'
                  ? '#f87171'
                  : '#94a3b8',
            }}
          >
            {status === 'connected' && '● Connected'}
            {status === 'connecting' && '● Connecting...'}
            {status === 'error' && '● Error'}
            {status === 'disconnected' && '● Disconnected'}
          </span>
          {errorMsg && (
            <span style={{ fontSize: '0.8rem', color: '#f87171', marginRight: '0.5rem' }}>{errorMsg}</span>
          )}
          {status === 'error' && (
            <button
              onClick={() => setRetryKey(k => k + 1)}
              style={{
                padding: '0.25rem 0.5rem',
                background: '#475569',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              Retry
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '0.35rem 0.75rem',
            background: '#334155',
            color: '#e2e8f0',
            border: 'none',
            borderRadius: '0.35rem',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          Close
        </button>
      </div>

      {/* Terminal container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          padding: '0.5rem',
          minHeight: 0,
          overflow: 'hidden',
        }}
      />
    </div>
  );
}
