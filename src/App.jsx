import { debounce } from 'lodash';

import '@rainbow-me/rainbowkit/styles.css';
import { connectorsForWallets } from '@rainbow-me/rainbowkit'; // Import uniswapWallet and connectorsForWallets
import { uniswapWallet, metaMaskWallet, coinbaseWallet } from '@rainbow-me/rainbowkit/wallets';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { getDefaultConfig, RainbowKitProvider} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { base} from 'wagmi/chains';
import { QueryClientProvider,QueryClient} from "@tanstack/react-query";

import React, { useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
import './App.css';

const CONTRACT_ADDRESS = '0xa9c9dcb054421dedc9d9006cffe843d0a5cd6339';
const API_KEY = 'XYYDPN75YC4Y3NEQ5P36KCGVH1UCR4PVC9';
const blocksPerYear = Number(43200 * 365);

const url = `https://api.geckoterminal.com/api/v2/simple/networks/base/token_price/0xa9c9dcb054421dedc9d9006cffe843d0a5cd6339`;

const requestOptions = {
  method: 'GET',
  headers: {
    'Accept': 'application/json;version=20230302',
    'Authorization': `Bearer ${API_KEY}` // Add API key to the Authorization header
  },
};
// Set up wallet connectors
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [uniswapWallet, metaMaskWallet, coinbaseWallet,], // Include Uniswap wallet in the Recommended group
    },
    // Add other wallet groups as needed
  ],
  { appName: 'susbase', projectId: 'susbase1' },
);

//CONNECT
const config = getDefaultConfig({
  connectors,
  appName: 'susbase',
  projectId: 'susbase1',
  chains: [base],
  ssr: true,
});

const queryClient = new QueryClient();

const App = () => {
  const [susBalance, setSusBalance] = useState(null);
  const [lockedAmount, setLockedAmount] = useState(0);
  const [lockingTime, setLockingTime] = useState(null);
  const [tokensMinted, setTokensMinted] = useState(0);
  const [lockApy, setLockApy] = useState(0);
  const [susTokenPrice, setSusTokenPrice] = useState(null);
  const [susBalancePrice, setSusBalancePrice] = useState(null);
  const [TLVprice, setTLVprice] = useState(null);
  const [mintedPrice, setMintedPrice] = useState(null);

  
  const handleStakeClick = () => {
    // Redirect to the Balancer website
    window.location.href = 'https://app.balancer.fi/#/base/pool/0x65e8e75899f683c8e2e73c77d6c5c63075f296cd00020000000000000000002b';
  };


  const fetchSusTokenPrice = useCallback(async () => {
    try {
      const response = await fetch(url, requestOptions);
      const data = await response.json();

      console.log('API Response:', data);

      const susTokenPrice = data?.data?.attributes?.token_prices?.['0xa9c9dcb054421dedc9d9006cffe843d0a5cd6339'];
      setSusTokenPrice(Number(susTokenPrice));
    } catch (error) {
      console.error('Error fetching SUS token price:', error);
    }
  }, [setSusTokenPrice]);


  const fetchContract = useCallback(async () => {
    const abiResponse = await fetch(`https://api.basescan.org/api?module=contract&action=getabi&address=${CONTRACT_ADDRESS}&apikey=${API_KEY}`);
    const abiData = await abiResponse.json();
    const contractABI = JSON.parse(abiData.result);
    const web3 = new Web3(window.ethereum);
    return new web3.eth.Contract(contractABI, CONTRACT_ADDRESS);
  }, []);

  // DENOUNCE
  const getSusBalance = useCallback(debounce(async () => {
      const { ethereum } = window;
    
      if (typeof ethereum !== 'undefined' && ethereum.isMetaMask) {
        try {
          const [account] = await ethereum.request({ method: 'eth_accounts' });
    
          const susContract = await fetchContract();
          const userBalance = await susContract.methods.balanceOf(account).call();
    
          const userBalanceInTokens = Web3.utils.fromWei(userBalance, 'ether');
          setSusBalance(userBalanceInTokens);
        } catch (error) {
          console.error('Error fetching SUS balance:', error);
        }
      }
    }, 1000), [fetchContract]);
    
    

  const checkLockingTime = useCallback(async () => {
    const { ethereum } = window;
  
    if (typeof ethereum !== 'undefined' && ethereum.isMetaMask) {
      try {
        const [account] = await ethereum.request({ method: 'eth_accounts' });
        
        const susContract = await fetchContract();
        const lockingDetails = await susContract.methods.getLockedDetails(account).call();
  
        const { amount, blocksRemaining } = lockingDetails;
  
        const lockedAmountInTokens = Web3.utils.fromWei(amount, 'ether');
  
        console.log('Amount Locked:', lockedAmountInTokens);
        console.log('Blocks Remaining:', blocksRemaining);
  
        await getSusBalance();
  
        if (Number(blocksRemaining) === 0) {
          setLockedAmount(0);
          setTokensMinted(0);
        } else {
          setLockedAmount(lockedAmountInTokens);
          setTokensMinted(Math.round(lockedAmountInTokens / 5));
        }
  
        setLockingTime((Number(blocksRemaining) / 43200).toFixed(1));
  
        await fetchSusTokenPrice();
        setSusBalancePrice(susBalance * susTokenPrice);
        setTLVprice(lockedAmount * susTokenPrice);
        setMintedPrice(tokensMinted * susTokenPrice); // Fix variable name here
        setLockApy((20 * (blocksPerYear / (150 * Math.sqrt(Number(lockedAmount))))).toFixed(2));

      } catch (error) {
        console.error('Error checking locking time:', error);
      }
    }
  }, [susBalance, susTokenPrice, lockedAmount, tokensMinted, getSusBalance, fetchContract, fetchSusTokenPrice]);
  
  //DENOUNCE 
  useEffect(() => {
    const fetchDataAndUpdateInterval = async () => {
      try {
        await getSusBalance();
        await fetchSusTokenPrice();
        await checkLockingTime(); // Call checkLockingTime here
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
  
    fetchDataAndUpdateInterval();
  
    const intervalId = setInterval(fetchDataAndUpdateInterval, 60000);
  
    return () => clearInterval(intervalId);
  }, [getSusBalance, fetchSusTokenPrice, checkLockingTime]);
  

  useEffect(() => {
    const updateCalculations = async () => {
      try {
        await checkLockingTime();
      } catch (error) {
        console.error('Error updating calculations:', error);
      }
    };

    updateCalculations();
  }, [susBalance, susTokenPrice, lockedAmount, tokensMinted, checkLockingTime, fetchSusTokenPrice, getSusBalance]);

  useEffect(() => {
    const fetchData = async () => {
      const fetchDataAndUpdateInterval = async () => {
        try {
          await getSusBalance();
          await fetchSusTokenPrice();
          await checkLockingTime();
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };

      fetchDataAndUpdateInterval();

      const intervalId = setInterval(fetchDataAndUpdateInterval, 60000);

      return () => clearInterval(intervalId);
    };

    fetchData();
  }, [fetchSusTokenPrice, getSusBalance, checkLockingTime]);

  useEffect(() => {
    // Create a meta element for viewport
    const metaViewport = document.createElement('meta');
    metaViewport.setAttribute('name', 'viewport');
    metaViewport.setAttribute('content', 'width=device-width, initial-scale=1');

    // Append the meta element to the document head
    document.head.appendChild(metaViewport);

    // Clean up by removing the meta element when the component unmounts
    return () => {
      document.head.removeChild(metaViewport);
    };
  }, []);


  return (
    <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
    <RainbowKitProvider>
    <div className="App">
      <header className="App-header">
        <div className="header-left">
            <img src="/suslogo2.png" alt="Logo" className="logo-container" />
          <div className="text-container">
            <h1>Sustainable Growth </h1>
          </div>
        </div>
        <div className="header-middle">
          <a href="#dashboard" className="active-tab">Dashboard</a>
          <span style={{ marginRight: '10%' }}></span>
          <a href="#stake" className="normal-tab" onClick={handleStakeClick}>Stake</a>
        </div>
        <div className="header-right">
            <img src="base.png" alt="Logobase" className="second-logo" />
            <ConnectButton />
        </div>
        <div className="balance">
          <div className="balance-info">
            <p> Balance: {susBalance !== null ? `${Math.round(susBalance).toLocaleString('en-US')}` : '0'}</p>
            <span className="sus-text">SUS</span>
            <p className="balance-price">
              {susBalancePrice !== null ? `$${susBalancePrice.toFixed(2)}` : ''}
            </p>
          </div>
        </div>
      </header>

      <div className="content">
        <div className="slogan">
          <h2>Healthy <span className="yield-text">yield</span> back to the user.</h2>
          <h2><span className="receiving-text">Receiving</span> is participating.</h2>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
            <tr>
                <th className="table-header1">Token locked value</th>
                <th className="table-header2">Tokens minted</th>
                <th className="table-header3">Time left</th>
                <th className="table-header4">Lock APY</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="locked-value">
                    {lockedAmount !== null ? (
                      <>
                        <span>{`${Math.round(lockedAmount).toLocaleString('en-US')}`}</span>
                        <span className="sus-text">SUS</span>
                      </>
                    ) : '0'}
                    <p className="tlv-price">
                      {TLVprice !== null ? `$${TLVprice.toFixed(2)}` : ''}
                    </p>
                  </div>
                </td>
                <td>
                  <div className="minted-tokens">
                    {tokensMinted !== null ? (
                      <>
                        <span>{`${Math.round(tokensMinted).toLocaleString('en-US')}`}</span>
                        <span className="sus-text">SUS</span>
                      </>
                    ) : '0'}
                    <p className="minted-price">
                      {mintedPrice !== null ? `$${mintedPrice.toFixed(2)}` : ''}
                    </p>
                  </div>
                </td>
                <td>
                <div className="time-left" style={{ marginRight: '50%' }}>
                  {lockingTime !== null ? (
                    <div className="time-container">
                      <span>{`${lockingTime} `}</span>
                      <span className="days-text">Days</span>
                    </div>
                  ) : '0'}
                </div>
                </td>
                <td>
                <div className="lock-apy" style={{ marginRight: '50%'}}>
                  {lockApy !== null ? (
                    <div className="apy-container">
                      <span>{`${lockApy} `}</span>
                      <span className="percentage-text">%</span>
                    </div>
                  ) : '...'}
                </div>

                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </RainbowKitProvider>
    </QueryClientProvider>
    </WagmiProvider> 
  );
}

export default App;