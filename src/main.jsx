import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Define the Arc Testnet chain specifications (Standard and Legacy)
const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
};

const arcTestnetLegacy = {
  ...arcTestnet,
  id: 504202,
  name: 'Arc Testnet (Legacy)',
};

// Configure RainbowKit and wagmi
const config = getDefaultConfig({
  appName: 'Liminal Space Shooter',
  projectId: '0e48dd8f84c7f5ec334d2ed90e4d1995', // WalletConnect dummy project ID
  chains: [arcTestnet, arcTestnetLegacy],
  ssr: false,
});

// Style the react-root container dynamically to overlay on top of the game canvas
if (typeof document !== 'undefined') {
  const reactRoot = document.getElementById('react-root');
  if (reactRoot) {
    reactRoot.style.position = 'absolute';
    reactRoot.style.top = '0';
    reactRoot.style.left = '0';
    reactRoot.style.width = '100%';
    reactRoot.style.height = '100%';
    reactRoot.style.pointerEvents = 'none';
    reactRoot.style.zIndex = '999999';
  }
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('react-root')).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({
          accentColor: '#ffcc00', // Yellow retro tint matching the game style
          accentColorForeground: '#000000',
          borderRadius: 'none', // Sharp retro corners
        })}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);

