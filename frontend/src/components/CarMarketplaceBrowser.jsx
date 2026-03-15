/**
 * CarMarketplaceBrowser - Browse CarSale listings with features, mechanic report, investigator report.
 * Buyers use this to see cars, features that incentivize purchase, and reports before deciding.
 */
import { useState, useEffect } from 'react';

const CarSaleABI = [
  'function currentState() view returns (uint8)',
  'function salePrice() view returns (uint256)',
  'function getCarFeatures() view returns (uint16 year, uint32 mileage, string make, string model)',
  'function getMechanicReport() view returns (bool passed, address)',
  'function getInvestigatorReport() view returns (bool passed, bool submitted)',
];

const MarketplaceABI = [
  'function getListings() view returns (address[])',
];

const STATES = ['Listed', 'DepositPaid', 'InspectionRequested', 'InspectionPassed', 'InspectionFailed', 'Completed', 'Refunded'];

export default function CarMarketplaceBrowser({ provider, marketplaceAddr, onSelectCarSale }) {
  const [listings, setListings] = useState([]);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!provider || !marketplaceAddr || !marketplaceAddr.startsWith('0x') || marketplaceAddr.length !== 42) {
      setListings([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { ethers } = await import('ethers');
        const mkt = new ethers.Contract(marketplaceAddr, MarketplaceABI, provider);
        const addrs = await mkt.getListings();
        if (cancelled) return;
        setListings(addrs);
        const d = {};
        for (let i = 0; i < addrs.length; i++) {
          try {
            const c = new ethers.Contract(addrs[i], CarSaleABI, provider);
            const [state, price, features, mechReport, invReport] = await Promise.all([
              c.currentState(),
              c.salePrice(),
              c.getCarFeatures(),
              c.getMechanicReport(),
              c.getInvestigatorReport(),
            ]);
            d[addrs[i]] = {
              state: STATES[Number(state)] || state,
              price: ethers.formatEther(price),
              year: features[0],
              mileage: features[1],
              make: features[2] || '',
              model: features[3] || '',
              mechanicPassed: mechReport[0],
              mechanicAddr: mechReport[1],
              invPassed: invReport[0],
              invSubmitted: invReport[1],
            };
          } catch (e) {
            d[addrs[i]] = { error: e.message };
          }
        }
        if (cancelled) return;
        setDetails(d);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load marketplace');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [provider, marketplaceAddr]);

  if (!marketplaceAddr || !marketplaceAddr.startsWith('0x')) return null;

  return (
    <div style={{
      marginTop: '1rem',
      padding: '1rem',
      background: 'rgba(59, 130, 246, 0.1)',
      borderRadius: '0.5rem',
      border: '1px solid rgba(59, 130, 246, 0.3)',
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#93c5fd' }}>🚗 Marketplace Listings</div>
      {loading && <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading...</div>}
      {error && <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>{error}</div>}
      {!loading && !error && listings.length === 0 && (
        <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No listings. Instructor adds CarSale addresses via addListing().</div>
      )}
      {!loading && !error && listings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {listings.map((addr) => {
            const d = details[addr];
            if (!d) return <div key={addr} style={{ color: '#64748b' }}>Loading {addr.slice(0, 10)}...</div>;
            if (d.error) return <div key={addr} style={{ color: '#fca5a5' }}>{addr.slice(0, 10)}...: {d.error}</div>;
            return (
              <div
                key={addr}
                onClick={() => onSelectCarSale?.(addr)}
                style={{
                  padding: '0.75rem',
                  background: '#0f172a',
                  borderRadius: '0.35rem',
                  border: '1px solid #334155',
                  cursor: onSelectCarSale ? 'pointer' : 'default',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ color: '#e2e8f0', marginBottom: '0.35rem' }}>
                  <strong>{(d.year && d.year > 0 ? d.year : '?')} {(d.make && d.make.trim()) || ''} {(d.model && d.model.trim()) || ''}</strong>
                  {(d.mileage !== undefined && d.mileage !== null) ? ` — ${Number(d.mileage).toLocaleString()} mi` : ''}
                </div>
                <div style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
                  Price: {d.price} ETH | State: {d.state}
                </div>
                <div style={{ color: '#86efac', fontSize: '0.8rem' }}>
                  Mechanic: {d.mechanicPassed === undefined ? '—' : d.mechanicPassed ? 'PASS' : 'FAIL'}
                  {d.invSubmitted && ` | Investigator: ${d.invPassed ? 'PASS' : 'FAIL'}`}
                </div>
                {onSelectCarSale && (
                  <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#64748b' }}>Click to select</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
