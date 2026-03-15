/**
 * RoleHub - Role-specific goals, tasks, example scripts, and quick actions.
 * Renders when myStake.role is set. Student-friendly: clear steps, inline results.
 */

import { useState, useRef, useEffect } from 'react';
import { getRoleContent } from '../constants/roleContent';
import CarMarketplaceBrowser from './CarMarketplaceBrowser';

const CarSaleABI = [
  'function currentState() view returns (uint8)',
  'function salePrice() view returns (uint256)',
  'function depositAmount() view returns (uint256)',
  'function getParticipants() view returns (address,address,address,address)',
  'function getMechanicReport() view returns (bool passed, address)',
  'function getTrueCondition() view returns (bool)',
  'function getInvestigatorReport() view returns (bool passed, bool submitted)',
  'function getCarFeatures() view returns (uint16 year, uint32 mileage, string make, string model)',
];

const CarBuyerRoleABI = [
  'function payDeposit() external',
  'function requestInspection() external',
  'function completePurchase() external',
  'function requestRefund() external',
];
const VictimRoleABI = ['function payRansomOnBehalf(address ransomContract) external payable'];
const MechanicRoleABI = ['function mechanicInspect(bool passed) external'];
const InvestigatorRoleABI = ['function submitFinding(address _found) external'];

export function RoleHub({
  role,
  myStake,
  wallet,
  provider,
  carSaleAddr,
  marketplaceAddr,
  ransomAddr,
  onCarSaleAddrChange,
  onMarketplaceAddrChange,
  onSelectCarSale,
  onRansomAddrChange,
  onLoadScript,
  onExpandConsole,
  setStatusMsg,
}) {
  const [boundariesExpanded, setBoundariesExpanded] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [showFirstTime, setShowFirstTime] = useState(true);
  const [scriptModal, setScriptModal] = useState(null); // { name, code }
  const checkResultRef = useRef(null);
  const content = getRoleContent(role);

  // Fix for Hardhat console: provider.resolveName not implemented
  const RESOLVENAME_FIX = "// Paste this first in Hardhat console if you see resolveName error:\n(function(){const p=ethers.provider;p.resolveName=async n=>ethers.isAddress(n)?n:(()=>{throw new Error('ENS not supported - use hex addresses');})();})();\n\n";

  useEffect(() => {
    if (checkResult && checkResultRef.current) {
      checkResultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [checkResult]);
  if (!content || !role) return null;

  const carSaleAddrVal = carSaleAddr || localStorage.getItem('car_sale_addr') || '';
  const marketplaceAddrVal = marketplaceAddr || localStorage.getItem('marketplace_addr') || '';
  const ransomAddrVal = ransomAddr || localStorage.getItem('ransom_addr') || '';

  /** Run "Check CarSale State" and show result inline - no console needed */
  const handleCheckCarSaleState = async () => {
    if (!carSaleAddrVal || !carSaleAddrVal.startsWith('0x') || carSaleAddrVal.length !== 42) {
      setStatusMsg?.('Paste the CarSale address above first. Your instructor shares it in chat.');
      setTimeout(() => setStatusMsg?.(''), 5000);
      return;
    }
    if (!provider) {
      setStatusMsg?.('Connect your wallet first.');
      return;
    }
    setCheckLoading(true);
    setCheckResult(null);
    setStatusMsg?.('⏳ Checking CarSale state...');
    try {
      const { ethers } = await import('ethers');
      const c = new ethers.Contract(carSaleAddrVal, CarSaleABI, provider);
      const [state, price, deposit, participants] = await Promise.all([
        c.currentState(),
        c.salePrice(),
        c.depositAmount(),
        c.getParticipants(),
      ]);
      const states = ['Listed', 'DepositPaid', 'InspectionRequested', 'InspectionPassed', 'InspectionFailed', 'Completed', 'Refunded'];
      const stateName = states[Number(state)] || state;
      const result = {
        state: stateName,
        price: ethers.formatEther(price),
        deposit: ethers.formatEther(deposit),
        seller: participants[1]?.slice(0, 6) + '...' + participants[1]?.slice(-4),
        buyer: participants[2]?.slice(0, 6) + '...' + participants[2]?.slice(-4),
        mechanic: participants[3]?.slice(0, 6) + '...' + participants[3]?.slice(-4),
      };
      setCheckResult(result);
      setStatusMsg?.(`✅ State: ${stateName} | Price: ${result.price} ETH`);
      setTimeout(() => setStatusMsg?.(''), 4000);
    } catch (e) {
      const errMsg = e.reason || e.message;
      setCheckResult({ error: errMsg });
      setStatusMsg?.('❌ ' + errMsg);
      setTimeout(() => setStatusMsg?.(''), 5000);
    } finally {
      setCheckLoading(false);
    }
  };

  /** Detective: Check for mechanic fraud - compare trueCondition vs mechanic report. Uses CarInvestigatorRole.getTrueCondition() or direct CarSale if wallet is investigator. */
  const handleDetectiveCheckFraud = async () => {
    if (!carSaleAddrVal || !carSaleAddrVal.startsWith('0x') || carSaleAddrVal.length !== 42) {
      setStatusMsg?.('Paste the CarSale address above first. Your instructor shares it in chat.');
      setTimeout(() => setStatusMsg?.(''), 5000);
      return;
    }
    if (!wallet?.signer) {
      setStatusMsg?.('Connect your wallet.');
      setTimeout(() => setStatusMsg?.(''), 5000);
      return;
    }
    setCheckLoading(true);
    setCheckResult(null);
    setStatusMsg?.('⏳ Checking for fraud...');
    try {
      const { ethers } = await import('ethers');
      const carSaleRead = new ethers.Contract(carSaleAddrVal, CarSaleABI, provider);
      let trueCond;
      if (myStake?.roleContract) {
        const invAbi = ['function getTrueCondition(address carSale) view returns (bool)'];
        const inv = new ethers.Contract(myStake.roleContract, invAbi, wallet.signer);
        trueCond = await inv.getTrueCondition(carSaleAddrVal);
      } else {
        const carSaleWrite = new ethers.Contract(carSaleAddrVal, CarSaleABI, wallet.signer);
        trueCond = await carSaleWrite.getTrueCondition();
      }
      const [report, state] = await Promise.all([
        carSaleRead.getMechanicReport(),
        carSaleRead.currentState(),
      ]);
      const states = ['Listed', 'DepositPaid', 'InspectionRequested', 'InspectionPassed', 'InspectionFailed', 'Completed', 'Refunded'];
      const stateName = states[Number(state)] || state;
      const hasInspected = Number(state) >= 3;
      let fraud = false;
      if (!hasInspected) {
        setCheckResult({ state: stateName, fraud: null, message: 'Mechanic has not inspected yet. Wait for inspection.' });
      } else {
        const match = trueCond === report[0];
        fraud = !match;
        setCheckResult({
          state: stateName,
          fraud,
          trueCondition: trueCond ? 'good' : 'lemon',
          mechanicSaid: report[0] ? 'pass' : 'fail',
          message: match
            ? '✓ Mechanic honest: report matches true condition.'
            : '⚠️ FRAUD: True condition=' + (trueCond ? 'good' : 'lemon') + ', mechanic said=' + (report[0] ? 'pass' : 'fail') + ' — mechanic lied!',
        });
      }
      setStatusMsg?.(hasInspected ? (fraud ? '⚠️ Fraud detected!' : '✅ Mechanic honest') : '⏳ No inspection yet');
      setTimeout(() => setStatusMsg?.(''), 4000);
    } catch (e) {
      const errMsg = e.reason || e.message;
      setCheckResult({ error: errMsg });
      setStatusMsg?.('❌ ' + errMsg + (errMsg?.includes('Only investigator') ? ' — Instructor must call setInvestigator(yourAddress) on CarSale.' : ''));
      setTimeout(() => setStatusMsg?.(''), 6000);
    } finally {
      setCheckLoading(false);
    }
  };

  /** Detective: Submit investigator report (honest or bribed). Buyer pays off-chain; you report. */
  const handleDetectiveSubmitReport = async (passed) => {
    if (!carSaleAddrVal || !carSaleAddrVal.startsWith('0x') || carSaleAddrVal.length !== 42) {
      setStatusMsg?.('Paste the CarSale address above first.');
      setTimeout(() => setStatusMsg?.(''), 5000);
      return;
    }
    if (!wallet?.signer || !myStake?.roleContract) {
      setStatusMsg?.('❌ Deploy CarInvestigatorRole and register. Instructor must set it as investigator in CarSale.');
      setTimeout(() => setStatusMsg?.(''), 5000);
      return;
    }
    setStatusMsg?.('⏳ Submitting report...');
    try {
      const { ethers } = await import('ethers');
      const invAbi = ['function submitReport(address carSale, bool passed)'];
      const inv = new ethers.Contract(myStake.roleContract, invAbi, wallet.signer);
      const tx = await inv.submitReport(carSaleAddrVal, passed);
      await tx.wait();
      setStatusMsg?.('✅ Report submitted. Buyer can now see it (you may have reported honestly or been bribed).');
      setTimeout(() => setStatusMsg?.(''), 4000);
    } catch (e) {
      const errMsg = e.reason || e.message;
      setStatusMsg?.('❌ ' + errMsg);
      setTimeout(() => setStatusMsg?.(''), 5000);
    }
  };

  /** Load script into console, injecting address if available */
  const loadScript = (code, opts = {}) => {
    let finalCode = code;
    if (opts.injectCarSale && carSaleAddrVal) {
      finalCode = code.replace(/'0x\.\.\.'/g, `'${carSaleAddrVal}'`).replace(/carSaleAddr = '0x\.\.\.'/g, `carSaleAddr = '${carSaleAddrVal}'`);
    }
    if (opts.injectRansom && ransomAddrVal) {
      finalCode = (finalCode || code).replace(/'0x\.\.\.'/g, `'${ransomAddrVal}'`).replace(/ransomAddr = '0x\.\.\.'/g, `ransomAddr = '${ransomAddrVal}'`);
    }
    if (onLoadScript) onLoadScript(finalCode);
    if (onExpandConsole) onExpandConsole(true);
    if (setStatusMsg) {
      setStatusMsg('Script pasted into Hardhat console. Wait for the > prompt, then press Enter to run.');
      setTimeout(() => setStatusMsg?.(''), 4000);
    }
  };

  const handleCarBuyerAction = async (action) => {
    if (!wallet?.signer || !myStake?.roleContract) {
      setStatusMsg?.('❌ Need: connected wallet and registered CarBuyerRole.');
      return;
    }
    const { ethers } = await import('ethers');
    const buyerContract = new ethers.Contract(myStake.roleContract, CarBuyerRoleABI, wallet.signer);
    try {
      if (action === 'payDeposit') {
        const tx = await buyerContract.payDeposit();
        await tx.wait();
        setStatusMsg?.('✅ Deposit paid.');
      } else if (action === 'requestInspection') {
        const tx = await buyerContract.requestInspection();
        await tx.wait();
        setStatusMsg?.('✅ Inspection requested.');
      } else if (action === 'completePurchase') {
        const tx = await buyerContract.completePurchase();
        await tx.wait();
        setStatusMsg?.('✅ Purchase completed.');
      } else if (action === 'requestRefund') {
        const tx = await buyerContract.requestRefund();
        await tx.wait();
        setStatusMsg?.('✅ Refund requested.');
      }
    } catch (e) {
      setStatusMsg?.('❌ ' + (e.reason || e.message));
    }
    setTimeout(() => setStatusMsg?.(''), 5000);
  };

  const handleMechanicAction = async (passed) => {
    if (!wallet?.signer || !myStake?.roleContract) {
      setStatusMsg?.('❌ Need: connected wallet and registered MechanicRole.');
      return;
    }
    const { ethers } = await import('ethers');
    const mechanicContract = new ethers.Contract(myStake.roleContract, MechanicRoleABI, wallet.signer);
    try {
      const tx = await mechanicContract.mechanicInspect(passed);
      await tx.wait();
      setStatusMsg?.(passed ? '✅ Inspection passed.' : '✅ Inspection failed.');
    } catch (e) {
      setStatusMsg?.('❌ ' + (e.reason || e.message));
    }
    setTimeout(() => setStatusMsg?.(''), 5000);
  };

  const handleVictimPayRansom = async () => {
    if (!wallet?.signer || !myStake?.roleContract || !ransomAddr) {
      setStatusMsg?.('❌ Need: connected wallet, VictimRole, and RansomPayment address from instructor.');
      return;
    }
    const amount = window.prompt('Amount in ETH:', '0.5');
    if (!amount) return;
    const { ethers } = await import('ethers');
    const victim = new ethers.Contract(myStake.roleContract, VictimRoleABI, wallet.signer);
    try {
      const tx = await victim.payRansomOnBehalf(ransomAddr, { value: ethers.parseEther(amount) });
      await tx.wait();
      setStatusMsg?.('✅ Ransom paid.');
    } catch (e) {
      setStatusMsg?.('❌ ' + (e.reason || e.message));
    }
    setTimeout(() => setStatusMsg?.(''), 5000);
  };

  const handleInvestigatorSubmit = async () => {
    const addr = window.prompt('Attacker\'s final address (0x...):');
    if (!addr || !addr.startsWith('0x') || addr.length !== 42) {
      setStatusMsg?.('❌ Enter a valid 0x address.');
      return;
    }
    if (!wallet?.signer || !myStake?.roleContract) {
      setStatusMsg?.('❌ Need: connected wallet and registered InvestigatorRole.');
      return;
    }
    const { ethers } = await import('ethers');
    const inv = new ethers.Contract(myStake.roleContract, InvestigatorRoleABI, wallet.signer);
    try {
      const tx = await inv.submitFinding(addr);
      await tx.wait();
      setStatusMsg?.('✅ Finding submitted. Instructor verifies for bounty.');
    } catch (e) {
      setStatusMsg?.('❌ ' + (e.reason || e.message));
    }
    setTimeout(() => setStatusMsg?.(''), 5000);
  };

  return (
    <div
      style={{
        marginTop: '1rem',
        padding: '1rem 1.25rem',
        background: `linear-gradient(135deg, ${content.color}22 0%, rgba(15, 23, 42, 0.95) 100%)`,
        borderRadius: '0.5rem',
        border: `1px solid ${content.color}66`,
        fontSize: '0.9rem',
        color: '#e2e8f0',
      }}
    >
      {/* New here? First-time guidance */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => setShowFirstTime(!showFirstTime)}
          style={{
            background: 'rgba(251, 191, 36, 0.2)',
            border: '1px solid rgba(251, 191, 36, 0.4)',
            color: '#fcd34d',
            padding: '0.4rem 0.75rem',
            borderRadius: '0.35rem',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          {showFirstTime ? '▼' : '▶'} New here? Start here
        </button>
        {showFirstTime && (
          <div style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '0.35rem',
            fontSize: '0.85rem',
            lineHeight: 1.6,
          }}>
            <strong>1.</strong> Your instructor assigns your role via chat. If you don&apos;t see a role yet, wait for them to send a message.<br />
            <strong>2.</strong> Get the contract address from your instructor (CarSale or RansomPayment). They share it in chat.<br />
            <strong>3.</strong> Paste that address in the box below.<br />
            <strong>4.</strong> Use the buttons to check state, pay deposit, etc. Results appear right here.
          </div>
        )}
      </div>

      {/* Step 1: Contract address - PROMINENT at top for Car Sale / Ransomware */}
      {/* Marketplace address - Car Buyer browses here */}
      {role === 'Car Buyer' && onMarketplaceAddrChange && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          background: 'rgba(34, 197, 94, 0.1)',
          borderRadius: '0.5rem',
          border: '1px solid rgba(34, 197, 94, 0.3)',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.35rem', color: '#86efac' }}>
            Marketplace address (browse cars, see features & reports)
          </div>
          <input
            placeholder="0x... (instructor deploys Car Marketplace, adds listings)"
            value={marketplaceAddrVal}
            onChange={(e) => onMarketplaceAddrChange?.(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              background: '#0f172a',
              border: '1px solid #475569',
              borderRadius: '0.35rem',
              color: '#e2e8f0',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
            }}
          />
          <CarMarketplaceBrowser
            provider={provider}
            marketplaceAddr={marketplaceAddrVal}
            onSelectCarSale={onSelectCarSale}
          />
        </div>
      )}
      {(role === 'Car Buyer' || role === 'Mechanic' || role === 'Car Seller' || role === 'Detective') && onCarSaleAddrChange && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          background: 'rgba(59, 130, 246, 0.15)',
          borderRadius: '0.5rem',
          border: '1px solid rgba(59, 130, 246, 0.3)',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.35rem', color: '#93c5fd' }}>
            CarSale address (from marketplace or instructor)
          </div>
          <input
            placeholder="0x... (click a car in marketplace or get from instructor)"
            value={carSaleAddrVal}
            onChange={(e) => onCarSaleAddrChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              background: '#0f172a',
              border: '1px solid #475569',
              borderRadius: '0.35rem',
              color: '#e2e8f0',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
            }}
          />
        </div>
      )}
      {role === 'Victim' && onRansomAddrChange && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          background: 'rgba(139, 92, 246, 0.15)',
          borderRadius: '0.5rem',
          border: '1px solid rgba(139, 92, 246, 0.3)',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.35rem', color: '#a78bfa' }}>
            RansomPayment address (get from instructor, paste here)
          </div>
          <input
            placeholder="0x... (instructor shares this in chat)"
            value={ransomAddrVal}
            onChange={(e) => onRansomAddrChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              background: '#0f172a',
              border: '1px solid #475569',
              borderRadius: '0.35rem',
              color: '#e2e8f0',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
            }}
          />
        </div>
      )}

      {/* Section 1: Role badge + tagline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '2rem' }}>{content.icon}</span>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: content.color }}>
            {role}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>{content.tagline}</div>
        </div>
      </div>

      {/* Section 2: Goals */}
      {content.goals?.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#94a3b8' }}>Goals</div>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.6 }}>
            {content.goals.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Section 3: Tasks */}
      {content.tasks?.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#94a3b8' }}>Tasks</div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.6 }}>
            {content.tasks.map((t, i) => (
              <li key={i} style={{ marginBottom: '0.25rem' }}>
                {t.doneKey && myStake?.[t.doneKey] ? '✅ ' : '☐ '}
                {t.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 4: Example Scripts */}
      {content.scripts?.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#94a3b8' }}>
            Example Scripts
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {content.scripts.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  let code = s.code;
                  const injectCarSale = ['Car Buyer', 'Mechanic', 'Car Seller', 'Detective'].includes(role);
                  const injectRansom = ['Victim', 'Investigator'].includes(role);
                  if (injectCarSale && carSaleAddrVal) code = code.replace(/'0x\.\.\.'/g, `'${carSaleAddrVal}'`).replace(/carSaleAddr = '0x\.\.\.'/g, `carSaleAddr = '${carSaleAddrVal}'`);
                  if (injectRansom && ransomAddrVal) code = code.replace(/'0x\.\.\.'/g, `'${ransomAddrVal}'`).replace(/ransomAddr = '0x\.\.\.'/g, `ransomAddr = '${ransomAddrVal}'`);
                  setScriptModal({ name: s.name, code, injectCarSale, injectRansom });
                }}
                style={{
                  padding: '0.4rem 0.75rem',
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '0.35rem',
                  color: '#93c5fd',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Script modal - show script as text, copy to clipboard */}
      {scriptModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setScriptModal(null)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              maxWidth: '90vw',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: '#e2e8f0' }}>{scriptModal.name}</strong>
              <button
                onClick={() => setScriptModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '1rem', overflow: 'auto', flex: 1 }}>
              <pre
                style={{
                  margin: 0,
                  padding: '1rem',
                  background: '#020617',
                  borderRadius: '0.35rem',
                  fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                  color: '#cbd5e1',
                  fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                }}
              >
                {RESOLVENAME_FIX}{scriptModal.code}
              </pre>
            </div>
            <div style={{ padding: '1rem', borderTop: '1px solid #334155', display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(RESOLVENAME_FIX + scriptModal.code);
                    setStatusMsg?.('Copied to clipboard. Paste into Hardhat console.');
                    setTimeout(() => setStatusMsg?.(''), 3000);
                  } catch (_) {
                    setStatusMsg?.('Copy failed. Select and copy manually.');
                  }
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(59, 130, 246, 0.3)',
                  border: '1px solid rgba(59, 130, 246, 0.5)',
                  borderRadius: '0.35rem',
                  color: '#93c5fd',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Copy script
              </button>
              {onLoadScript && (
                <button
                  onClick={() => {
                    loadScript(scriptModal.code, {
                      injectCarSale: scriptModal.injectCarSale,
                      injectRansom: scriptModal.injectRansom,
                    });
                    setScriptModal(null);
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(34, 197, 94, 0.2)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    borderRadius: '0.35rem',
                    color: '#4ade80',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  Load into terminal
                </button>
              )}
              <button
                onClick={() => setScriptModal(null)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  border: '1px solid #475569',
                  borderRadius: '0.35rem',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 5: Scenario Boundaries */}
      {content.boundaries && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => setBoundariesExpanded(!boundariesExpanded)}
            style={{
              background: 'transparent',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              color: '#94a3b8',
              padding: '0.35rem 0.6rem',
              borderRadius: '0.35rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            {boundariesExpanded ? '▼ Hide' : '▶ Read'} scenario boundaries
          </button>
          {boundariesExpanded && (
            <pre
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '0.35rem',
                fontSize: '0.8rem',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                color: '#cbd5e1',
              }}
            >
              {content.boundaries}
            </pre>
          )}
        </div>
      )}

      {/* Section 6: Quick Actions (role-specific buttons) */}
      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#94a3b8' }}>Quick Actions</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {/* Car Buyer */}
          {(role === 'Car Buyer') && (
            <>
              <button
                onClick={handleCheckCarSaleState}
                disabled={checkLoading}
                style={btnStyle}
              >
                {checkLoading ? 'Checking...' : 'Check CarSale State'}
              </button>
              {checkResult && (
                <div
                  ref={checkResultRef}
                  style={{
                    width: '100%',
                    flexBasis: '100%',
                    padding: '0.75rem',
                    background: checkResult.error ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    borderRadius: '0.5rem',
                    border: `1px solid ${checkResult.error ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
                    fontSize: '0.85rem',
                    color: checkResult.error ? '#fca5a5' : '#86efac',
                  }}
                >
                  {checkResult.error ? (
                    <>Error: {checkResult.error}</>
                  ) : (
                    <>
                      <strong>State:</strong> {checkResult.state} | <strong>Price:</strong> {checkResult.price} ETH | <strong>Deposit:</strong> {checkResult.deposit} ETH<br />
                      Seller: {checkResult.seller} | Buyer: {checkResult.buyer} | Mechanic: {checkResult.mechanic}
                    </>
                  )}
                </div>
              )}
              <button onClick={() => handleCarBuyerAction('payDeposit')} style={btnStyle}>
                Pay Deposit
              </button>
              <button onClick={() => handleCarBuyerAction('requestInspection')} style={btnStyle}>
                Request Inspection
              </button>
              <button onClick={() => handleCarBuyerAction('completePurchase')} style={btnStyle}>
                Complete Purchase
              </button>
              <button onClick={() => handleCarBuyerAction('requestRefund')} style={btnStyle}>
                Request Refund
              </button>
            </>
          )}
          {/* Mechanic */}
          {role === 'Mechanic' && (
            <>
              <button onClick={handleCheckCarSaleState} disabled={checkLoading} style={btnStyle}>
                {checkLoading ? 'Checking...' : 'Check CarSale State'}
              </button>
              {checkResult && role === 'Mechanic' && (
                <div ref={checkResultRef} style={{ width: '100%', flexBasis: '100%', padding: '0.75rem', background: 'rgba(34, 197, 94, 0.15)', borderRadius: '0.5rem', border: '1px solid rgba(34, 197, 94, 0.4)', fontSize: '0.85rem', color: '#86efac' }}>
                  {checkResult.error ? <>Error: {checkResult.error}</> : <>State: {checkResult.state} | Price: {checkResult.price} ETH</>}
                </div>
              )}
              <button onClick={() => handleMechanicAction(true)} style={btnStyle}>
                Inspect Pass
              </button>
              <button onClick={() => handleMechanicAction(false)} style={btnStyle}>
                Inspect Fail
              </button>
            </>
          )}
          {/* Detective (Car Sale) */}
          {role === 'Detective' && (
            <>
              <button onClick={handleDetectiveCheckFraud} disabled={checkLoading} style={btnStyle}>
                {checkLoading ? 'Checking...' : 'Check for Fraud'}
              </button>
              <button onClick={() => handleDetectiveSubmitReport(true)} style={btnStyle}>
                Submit Report: Pass
              </button>
              <button onClick={() => handleDetectiveSubmitReport(false)} style={btnStyle}>
                Submit Report: Fail
              </button>
              {checkResult && role === 'Detective' && (
                <div
                  ref={checkResultRef}
                  style={{
                    width: '100%',
                    flexBasis: '100%',
                    padding: '0.75rem',
                    background: checkResult.error ? 'rgba(239, 68, 68, 0.15)' : checkResult.fraud ? 'rgba(251, 191, 36, 0.2)' : 'rgba(34, 197, 94, 0.15)',
                    borderRadius: '0.5rem',
                    border: `1px solid ${checkResult.error ? 'rgba(239, 68, 68, 0.4)' : checkResult.fraud ? 'rgba(251, 191, 36, 0.5)' : 'rgba(34, 197, 94, 0.4)'}`,
                    fontSize: '0.85rem',
                    color: checkResult.error ? '#fca5a5' : checkResult.fraud ? '#fde047' : '#86efac',
                  }}
                >
                  {checkResult.error ? (
                    <>Error: {checkResult.error}</>
                  ) : (
                    <>{checkResult.message}</>
                  )}
                </div>
              )}
            </>
          )}
          {/* Victim */}
          {role === 'Victim' && (
            <button onClick={handleVictimPayRansom} style={btnStyle}>
              Pay Ransom
            </button>
          )}
          {/* Investigator */}
          {role === 'Investigator' && (
            <>
              <button
                onClick={() => content.scripts?.[0] && setScriptModal({
                  name: content.scripts[0].name,
                  code: ransomAddrVal ? content.scripts[0].code.replace(/'0x\.\.\.'/g, `'${ransomAddrVal}'`).replace(/ransomAddr = '0x\.\.\.'/g, `ransomAddr = '${ransomAddrVal}'`) : content.scripts[0].code,
                  injectCarSale: false,
                  injectRansom: true,
                })}
                style={btnStyle}
              >
                Trace Attacker
              </button>
              <button onClick={handleInvestigatorSubmit} style={btnStyle}>
                Submit Finding
              </button>
            </>
          )}
          {/* Fallback when no role-specific actions */}
          {!['Car Buyer', 'Mechanic', 'Detective', 'Victim', 'Investigator'].includes(role) &&
            content.scripts?.length > 0 && (
              <button
                onClick={() => {
                  const s = content.scripts[0];
                  let code = s.code;
                  const injectCarSale = ['Car Seller'].includes(role);
                  const injectRansom = false;
                  if (injectCarSale && carSaleAddrVal) code = code.replace(/'0x\.\.\.'/g, `'${carSaleAddrVal}'`).replace(/carSaleAddr = '0x\.\.\.'/g, `carSaleAddr = '${carSaleAddrVal}'`);
                  setScriptModal({ name: s.name, code, injectCarSale, injectRansom });
                }}
                style={btnStyle}
              >
                View example script
              </button>
            )}
        </div>
      </div>
    </div>
  );
}

const btnStyle = {
  padding: '0.4rem 0.75rem',
  background: 'rgba(34, 197, 94, 0.2)',
  border: '1px solid rgba(34, 197, 94, 0.4)',
  borderRadius: '0.35rem',
  color: '#86efac',
  cursor: 'pointer',
  fontSize: '0.8rem',
};
