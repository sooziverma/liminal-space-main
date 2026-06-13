import React, { useEffect, useState } from 'react';
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useReadContract,
  usePublicClient
} from 'wagmi';
import { parseEther } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';

// Solidity contract ABI
const CONTRACT_ABI = [
  {
    "inputs": [],
    "name": "payForSession",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "score",
        "type": "uint256"
      }
    ],
    "name": "submitScore",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "dailyCheckIn",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getLeaderboard",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "player",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "score",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "bonusPoints",
            "type": "uint256"
          }
        ],
        "internalType": "struct LiminalSpaceGame.LeaderboardEntry[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getStats",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "highScore",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "bonusPoints",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "lastDailyCheckIn",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "pendingSessions",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Deployed smart contract address on Arc Testnet
const CONTRACT_ADDRESS = "0xeF0867eC5EA5C66A4c5eD06AE5dae5984CE8e882";
const REQUIRED_CHAIN_ID = 504202; // Arc Testnet
const ALTERNATIVE_CHAIN_ID = 5042002; // RPC returns this
const isArcTestnet = (id) => id === REQUIRED_CHAIN_ID || id === ALTERNATIVE_CHAIN_ID;

let originalStartGame = null;

export default function App() {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { switchChain, switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();

  // Contract Write hook
  const { writeContractAsync } = useWriteContract();

  // Local transaction state variables for robustness and avoiding stale React states
  const [localSending, setLocalSending] = useState(false);
  const [localConfirming, setLocalConfirming] = useState(false);
  const [localError, setLocalError] = useState(null);

  const [paymentType, setPaymentType] = useState(null); // 'session', 'score', 'daily'
  const [scoreToSubmit, setScoreToSubmit] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayStatus, setOverlayStatus] = useState('');
  const [web3Stats, setWeb3Stats] = useState({
    highScore: 0,
    bonusPoints: 0,
    lastDailyCheckIn: 0,
    pendingSessions: 0
  });

  // Shorten wallet addresses for display
  const shortenAddress = (addr) => {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  };

  // Fetch user stats from blockchain via direct call using ethers/viem
  const fetchStats = async () => {
    if (!isConnected || !address || !isArcTestnet(chainId) || CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") return;
    try {
      // We read the stats via fetch/JSON-RPC directly since we are integrating into wagmi.
      // Alternatively, we use standard fetch or useReadContract (readContract is cleaner).
      // For simplicity, we can fetch using raw json rpc call
      const response = await fetch("https://rpc.testnet.arc.network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [
            {
              to: CONTRACT_ADDRESS,
              // getStats(address) selector: 0xc4c7b8c7 + 32-byte padded address
              data: "0xc4c7b8c7" + address.substring(2).toLowerCase().padStart(64, '0')
            },
            "latest"
          ]
        })
      });
      const resData = await response.json();
      if (resData.result && resData.result !== '0x') {
        const hex = resData.result.substring(2);
        const highScore = parseInt(hex.substring(0, 64), 16);
        const bonusPoints = parseInt(hex.substring(64, 128), 16);
        const lastDailyCheckIn = parseInt(hex.substring(128, 192), 16);
        const pendingSessions = parseInt(hex.substring(192, 256), 16);

        setWeb3Stats({ highScore, bonusPoints, lastDailyCheckIn, pendingSessions });
      }
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [address, isConnected, chainId]);

  // Sync React state to HTML UI
  useEffect(() => {
    if (!window.DOM) return;

    // Update Identifier and coins badge
    if (isConnected && address) {
      window.DOM.usernameLabel.innerText = shortenAddress(address);
      window.DOM.coinsLabel.innerText = `🎁 ${web3Stats.bonusPoints} BP`;
    } else {
      window.DOM.usernameLabel.innerText = "No Wallet Connected";
      window.DOM.coinsLabel.innerText = "🪙 0";
    }
  }, [isConnected, address, web3Stats]);

  // Chain changes monitoring during gameplay
  useEffect(() => {
    if (isConnected && !isArcTestnet(chainId) && window.gameState === 'playing') {
      // Pause game immediately and show warning
      if (window.pauseGame) {
        window.pauseGame();
      }
      alert("Unsupported network detected during gameplay! Pausing game. Please switch back to Arc Testnet.");
    }
  }, [chainId, isConnected]);

  const getActiveChainId = async () => {
    try {
      if (connector) {
        const provider = await connector.getProvider();
        if (provider && typeof provider.request === 'function') {
          const hexChainId = await provider.request({ method: 'eth_chainId' });
          return parseInt(hexChainId, 16);
        }
      }
      if (window.ethereum) {
        const hexChainId = await window.ethereum.request({ method: 'eth_chainId' });
        return parseInt(hexChainId, 16);
      }
    } catch (err) {
      console.error("Error detecting chain ID directly:", err);
    }
    return chainId;
  };

  const ensureCorrectNetwork = async () => {
    const activeChain = await getActiveChainId();
    if (isArcTestnet(activeChain)) {
      return true;
    }
    try {
      await switchChainAsync({ chainId: REQUIRED_CHAIN_ID });
      const newChain = await getActiveChainId();
      return isArcTestnet(newChain);
    } catch (err) {
      console.error("Failed to switch chain:", err);
      return false;
    }
  };

  // Hooking up global functions in game.js
  useEffect(() => {
    // 1. Play Session interceptor
    if (window.startGame && window.startGame !== originalStartGame) {
      originalStartGame = window.startGame;
    }

    window.startGame = async function () {
      if (!isConnected) {
        alert("Wallet connection is required to start a game session.");
        return;
      }
      const onCorrect = await ensureCorrectNetwork();
      if (!onCorrect) {
        alert("Please connect/switch to Arc Testnet to start a game session.");
        return;
      }

      setPaymentType('session');
      setShowOverlay(true);
      setOverlayStatus('Requesting 0.1 USDC payment for play session...');
    };

    // 2. Score submission interceptor
    window.submitScoreToLeaderboard = async function (score, kills) {
      if (!isConnected) {
        console.warn("Wallet not connected, skipping onchain leaderboard submission.");
        return;
      }
      const onCorrect = await ensureCorrectNetwork();
      if (!onCorrect) {
        console.warn("Wallet not on Arc Testnet, skipping onchain leaderboard submission.");
        return;
      }

      setScoreToSubmit(score);
      setPaymentType('score');
      setShowOverlay(true);
      setOverlayStatus(`Requesting 0.1 USDC payment to submit score of ${score}...`);
    };

    // 3. Daily Claim interceptor
    window.claimDailyReward = async function () {
      if (!isConnected) {
        alert("Please connect your wallet first.");
        return;
      }
      const onCorrect = await ensureCorrectNetwork();
      if (!onCorrect) {
        alert("Please connect to Arc Testnet to claim daily rewards.");
        return;
      }

      // Check client-side cooldown
      const now = Math.floor(Date.now() / 1000);
      const cooldownEnd = web3Stats.lastDailyCheckIn + 24 * 3600;
      if (now < cooldownEnd) {
        alert("Daily check-in is on cooldown.");
        return;
      }

      setPaymentType('daily');
      setShowOverlay(true);
      setOverlayStatus('Requesting 0.1 USDC payment for Daily Check-In...');
    };

    // 4. Update Daily UI from blockchain
    window.updateDailyCheckInUI = function () {
      const now = Math.floor(Date.now() / 1000);
      const cooldownEnd = web3Stats.lastDailyCheckIn + 24 * 3600;
      const canClaim = web3Stats.lastDailyCheckIn === 0 || now >= cooldownEnd;

      // Update indicators
      if (canClaim && isConnected) {
        window.DOM.dailyReadyDot.classList.remove('hidden');
      } else {
        window.DOM.dailyReadyDot.classList.add('hidden');
      }

      document.getElementById('streak-count').innerText = `${web3Stats.bonusPoints / 10} Claims`;

      // Update grid highlight
      const boxes = document.querySelectorAll('.day-box');
      const claimCount = (web3Stats.bonusPoints / 10) % 7;
      boxes.forEach((box, index) => {
        box.classList.remove('claimed', 'current', 'locked');
        if (index < claimCount) {
          box.classList.add('claimed');
        } else if (index === claimCount && canClaim) {
          box.classList.add('current');
        } else {
          box.classList.add('locked');
        }
      });

      const claimBtn = document.getElementById('btn-claim-daily');
      const timerDiv = document.getElementById('daily-timer');

      if (!isConnected) {
        claimBtn.classList.add('disabled');
        claimBtn.disabled = true;
        claimBtn.innerText = "CONNECT WALLET FIRST";
        timerDiv.classList.add('hidden');
      } else if (canClaim) {
        claimBtn.classList.remove('disabled');
        claimBtn.disabled = false;
        claimBtn.innerText = "CLAIM CHECK-IN (0.1 USDC)";
        timerDiv.classList.add('hidden');
      } else {
        claimBtn.classList.add('disabled');
        claimBtn.disabled = true;
        claimBtn.innerText = "ALREADY CLAIMED TODAY";
        timerDiv.classList.remove('hidden');

        // Setup countdown timer
        const diff = (cooldownEnd - now) * 1000;
        const countdownVal = document.getElementById('countdown-val');
        if (countdownVal) {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          countdownVal.innerText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
      }
    };

    // 5. Leaderboard fetch override
    window.renderLeaderboardUI = async function () {
      const tbody = window.DOM.leaderboardBody;
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#ffcc00;">LOADING ONCHAIN RECORDS...</td></tr>';

      if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#ff3333;">CONTRACT NOT DEPLOYED YET</td></tr>';
        return;
      }

      try {
        const response = await fetch("https://rpc.testnet.arc.network", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "eth_call",
            params: [
              {
                to: CONTRACT_ADDRESS,
                // getLeaderboard() selector: 0xda598284
                data: "0xda598284"
              },
              "latest"
            ]
          })
        });
        const resData = await response.json();

        tbody.innerHTML = '';
        if (resData.result && resData.result !== '0x') {
          const hex = resData.result.substring(2);
          const len = parseInt(hex.substring(64, 128), 16);

          const list = [];
          for (let i = 0; i < len; i++) {
            const baseOffset = 128 + len * 64 + i * 96;
            const playerHex = "0x" + hex.substring(baseOffset + 24, baseOffset + 64);
            const scoreVal = parseInt(hex.substring(baseOffset + 64, baseOffset + 128), 16);
            const bonusVal = parseInt(hex.substring(baseOffset + 128, baseOffset + 192), 16);

            if (playerHex !== "0x0000000000000000000000000000000000000000") {
              list.push({ player: playerHex, score: scoreVal, bonusPoints: bonusVal });
            }
          }

          list.sort((a, b) => b.score - a.score);

          if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;opacity:0.6;">NO ONCHAIN ENTRIES</td></tr>';
            return;
          }

          list.forEach((entry, i) => {
            const row = document.createElement('tr');
            if (address && entry.player.toLowerCase() === address.toLowerCase()) {
              row.classList.add('highlight');
            }

            row.innerHTML = `
                <td class="rank-cell">#${i + 1}</td>
                <td style="font-family: monospace;">${shortenAddress(entry.player)}</td>
                <td style="color: var(--bg-yellow); font-weight: bold;">${entry.score}</td>
                <td style="color: var(--neon-green);">${entry.bonusPoints} BP</td>
                <td style="font-size: 0.8rem; opacity: 0.6;">ON-CHAIN</td>
            `;
            tbody.appendChild(row);
          });
        } else {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;opacity:0.6;">NO ONCHAIN ENTRIES</td></tr>';
        }
      } catch (err) {
        console.error("Error rendering leaderboard:", err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#ff3333;">ERROR LOADING ONCHAIN RECORDS</td></tr>';
      }
    };
  }, [isConnected, address, web3Stats]);

  // Run the transaction
  const executePayment = async () => {
    // Log current info for debugging
    const currentChainId = await getActiveChainId();
    console.log("=== Transaction Execution Started ===");
    console.log("current chainId:", currentChainId);
    console.log("required chainId:", REQUIRED_CHAIN_ID);
    console.log("connected wallet address:", address);

    // Verify network directly before transaction starts
    const onCorrectNetwork = await ensureCorrectNetwork();
    if (!onCorrectNetwork) {
      console.warn("Chain check failed, canceling transaction execution.");
      setLocalError({ message: "Incorrect network. Please switch to Arc Testnet." });
      return;
    }

    setLocalSending(true);
    setLocalConfirming(false);
    setLocalError(null);
    setOverlayStatus("Confirming in wallet...");

    try {
      let hash;
      const paymentValue = parseEther('0.1');

      if (paymentType === 'session') {
        console.log("Calling payForSession on contract...");
        hash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'payForSession',
          value: paymentValue,
        });
      } else if (paymentType === 'score') {
        console.log(`Calling submitScore on contract with score: ${scoreToSubmit}...`);
        hash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'submitScore',
          args: [BigInt(scoreToSubmit)],
          value: paymentValue,
        });
      } else if (paymentType === 'daily') {
        console.log("Calling dailyCheckIn on contract...");
        hash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'dailyCheckIn',
          value: paymentValue,
        });
      }

      console.log("tx hash returned:", hash);

      if (!hash) {
        throw new Error("No transaction hash returned.");
      }

      // Real transaction hash returned
      setLocalSending(false);
      setLocalConfirming(true);
      setOverlayStatus("Confirming on blockchain...");

      console.log("Waiting for transaction receipt (raw direct RPC polling) for hash:", hash);
      let receipt = null;
      const startTime = Date.now();
      const timeoutMs = 60000; // 60 seconds timeout

      while (!receipt && (Date.now() - startTime < timeoutMs)) {
        try {
          const res = await fetch("https://rpc.testnet.arc.network", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 3,
              method: "eth_getTransactionReceipt",
              params: [hash]
            })
          });
          const resData = await res.json();
          if (resData.result) {
            receipt = resData.result;
            console.log("Found transaction receipt:", receipt);
            break;
          }
        } catch (pollErr) {
          console.error("Error polling receipt:", pollErr);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const status = receipt ? receipt.status : null;
      console.log("receipt status:", status);

      // On EVM, receipt.status is "0x1" (success) or "0x0" (failure), or 1 / 0
      if (!receipt || (status !== "0x1" && status !== 1 && status !== "1")) {
        throw new Error(receipt ? "Transaction failed on blockchain." : "Transaction confirmation timed out.");
      }

      // Success
      setLocalConfirming(false);
      setShowOverlay(false);

      if (paymentType === 'session') {
        alert("Play Session payment confirmed! Starting game.");
        if (originalStartGame) {
          originalStartGame();
        }
      } else if (paymentType === 'score') {
        alert("Score successfully submitted onchain!");
        if (window.renderLeaderboardUI) {
          window.renderLeaderboardUI();
        }
      } else if (paymentType === 'daily') {
        alert("Daily Check-In successful! 10 Bonus Points granted.");
        fetchStats();
      }

      setPaymentType(null);

    } catch (err) {
      console.error("contract error if any:", err);

      setLocalSending(false);
      setLocalConfirming(false);
      setShowOverlay(false);
      setPaymentType(null);

      // Detect user rejection vs general failure
      const errMsg = (err.shortMessage || err.message || "").toLowerCase();
      const isRejected = errMsg.includes("user rejected") ||
        errMsg.includes("user denied") ||
        errMsg.includes("rejected") ||
        err.code === 4001;

      if (isRejected) {
        alert("Transaction rejected.");
      } else {
        alert("Transaction failed.");
      }
    }
  };

  const cancelPayment = () => {
    setShowOverlay(false);
    setLocalSending(false);
    setLocalConfirming(false);
    setLocalError(null);
    setPaymentType(null);
  };

  // Warning banner for incorrect network
  const showWarningBanner = isConnected && !isArcTestnet(chainId);

  return (
    <>
      {/* Incorrect Chain Warning Banner */}
      {showWarningBanner && (
        <div style={bannerStyle}>
          <div style={bannerContentStyle}>
            <span style={bannerTextStyle}>Please switch to Arc Testnet to continue.</span>
            <button
              style={bannerButtonStyle}
              onClick={() => switchChain({ chainId: REQUIRED_CHAIN_ID })}
            >
              SWITCH NETWORK
            </button>
          </div>
        </div>
      )}

      {/* Web3 Custom Header/Wallet Button Overlay */}
      <div style={headerStyle}>
        <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
      </div>

      {/* USDC Transaction Confirmation Overlay */}
      {showOverlay && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={modalHeaderStyle}>USDC PAYMENT REQUIRED</h2>
            <div style={dividerStyle}></div>
            <p style={modalTextStyle}>
              This action requires a payment of exactly <b>0.1 USDC</b> on Arc Testnet.
            </p>
            <p style={{ ...modalTextStyle, color: '#ffcc00' }}>
              {overlayStatus}
            </p>

            {localError && (
              <p style={errorTextStyle}>
                Error: {localError.shortMessage || localError.message}
              </p>
            )}

            {(localSending || localConfirming) && (
              <div style={loadingContainerStyle}>
                <div style={spinnerStyle}></div>
                <span style={loadingTextStyle}>
                  {localSending ? 'Confirming in wallet...' : 'Confirming on blockchain...'}
                </span>
              </div>
            )}

            {!localSending && !localConfirming && (
              <div style={btnContainerStyle}>
                <button style={primaryBtnStyle} onClick={executePayment}>
                  CONFIRM & PAY
                </button>
                <button style={secondaryBtnStyle} onClick={cancelPayment}>
                  CANCEL
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Inline Styles matching retro game theme
const bannerStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  backgroundColor: '#ff3333',
  color: '#ffffff',
  padding: '10px 0',
  zIndex: 999999,
  fontFamily: 'Courier Prime, monospace',
  fontSize: '0.9rem',
  fontWeight: 'bold',
  borderBottom: '2px solid #000000',
  boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
};

const bannerContentStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '15px',
  maxWidth: '800px',
  margin: '0 auto',
  padding: '0 20px',
};

const bannerTextStyle = {
  letterSpacing: '1px',
};

const bannerButtonStyle = {
  backgroundColor: '#000000',
  color: '#ff3333',
  border: '2px solid #ffffff',
  padding: '4px 12px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontFamily: 'Share Tech Mono, sans-serif',
  letterSpacing: '1px',
};

const headerStyle = {
  position: 'absolute',
  top: '20px',
  right: '20px',
  zIndex: 9999,
};

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0,0,0,0.85)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 99999,
};

const modalStyle = {
  backgroundColor: '#111111',
  border: '3px solid #ffcc00',
  padding: '30px',
  width: '90%',
  maxWidth: '420px',
  textAlign: 'center',
  fontFamily: 'Courier Prime, monospace',
  boxShadow: '0 0 20px rgba(255, 204, 0, 0.3)',
};

const modalHeaderStyle = {
  color: '#ffcc00',
  fontSize: '1.4rem',
  margin: '0 0 15px 0',
  letterSpacing: '2px',
  fontFamily: 'Share Tech Mono, sans-serif',
};

const dividerStyle = {
  height: '2px',
  backgroundColor: '#ffcc00',
  width: '80%',
  margin: '0 auto 20px auto',
};

const modalTextStyle = {
  color: '#ffffff',
  fontSize: '0.95rem',
  lineHeight: '1.5',
  margin: '0 0 15px 0',
};

const errorTextStyle = {
  color: '#ff3333',
  fontSize: '0.85rem',
  margin: '15px 0 0 0',
  wordBreak: 'break-word',
};

const btnContainerStyle = {
  display: 'flex',
  justifyContent: 'center',
  gap: '15px',
  marginTop: '25px',
};

const primaryBtnStyle = {
  backgroundColor: '#ffcc00',
  color: '#000000',
  border: 'none',
  padding: '10px 20px',
  fontFamily: 'Share Tech Mono, sans-serif',
  fontWeight: 'bold',
  fontSize: '1rem',
  cursor: 'pointer',
  letterSpacing: '1px',
  transition: 'transform 0.1s',
};

const secondaryBtnStyle = {
  backgroundColor: '#222222',
  color: '#ffffff',
  border: '2px solid #ffffff',
  padding: '8px 18px',
  fontFamily: 'Share Tech Mono, sans-serif',
  fontWeight: 'bold',
  fontSize: '1rem',
  cursor: 'pointer',
  letterSpacing: '1px',
  transition: 'transform 0.1s',
};

const loadingContainerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  marginTop: '20px',
};

const loadingTextStyle = {
  color: '#ffcc00',
  fontSize: '0.85rem',
  fontWeight: 'bold',
};

const spinnerStyle = {
  width: '30px',
  height: '30px',
  border: '4px solid rgba(255, 204, 0, 0.2)',
  borderTop: '4px solid #ffcc00',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

// Add keyframes for spinner animation
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
  document.head.appendChild(styleSheet);
}
