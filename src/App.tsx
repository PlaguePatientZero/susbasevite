import { debounce } from 'lodash';

import '@rainbow-me/rainbowkit/styles.css';
import { ConnectButton} from '@rainbow-me/rainbowkit';


import React, { useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
import './App.css';

const CONTRACT_ADDRESS = '0xa9c9dcb054421dedc9d9006cffe843d0a5cd6339';
const API_KEY = 'XYYDPN75YC4Y3NEQ5P36KCGVH1UCR4PVC9';


const url = `https://api.geckoterminal.com/api/v2/simple/networks/base/token_price/0xa9c9dcb054421dedc9d9006cffe843d0a5cd6339`;

const requestOptions = {
  method: 'GET',
  headers: {
    'Accept': 'application/json;version=20230302',
    'Authorization': `Bearer ${API_KEY}` // Add API key to the Authorization header
  },
};


const App: React.FC = () => {
  const [susBalance, setSusBalance] = useState<number | null>(null);
  const [lockedAmount, setLockedAmount] = useState<number>(0);
  const [lockingTime, setLockingTime] = useState<number | null>(null);
  const [tokensMinted, setTokensMinted] = useState<number>(0);
  const [lockApy, setLockApy] = useState<number>(0);
  const [susTokenPrice, setSusTokenPrice] = useState<number | null>(null);
  const [susBalancePrice, setSusBalancePrice] = useState<number | null>(null);
  const [TLVprice, setTLVprice] = useState<number | null>(null);
  const [mintedPrice, setMintedPrice] = useState<number | null>(null);

  
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
  const getSusBalance = useCallback(
    debounce(async () => {
      const { ethereum } = window;
  
      if (typeof ethereum !== 'undefined' && ethereum.isMetaMask) {
        try {
          const [account] = await ethereum.request({ method: 'eth_accounts' });
  
          const susContract = await fetchContract();
          const userBalanceResponse = await susContract.methods.balanceOf(account).call();
  
          if (userBalanceResponse !== void 0 && Array.isArray(userBalanceResponse) && userBalanceResponse.length > 0) {
            const userBalance = userBalanceResponse as number[];
            const userBalanceInWei = userBalance[0].toString(); // Assuming userBalance is an array of numbers
            const userBalanceInTokens = Web3.utils.fromWei(userBalanceInWei, 'ether');
            setSusBalance(parseFloat(userBalanceInTokens)); // Parse or convert to number before setting state
          } else {
            console.error('Error fetching SUS balance: Unexpected response');
          }
        } catch (error) {
          console.error('Error fetching SUS balance:', error);
        }
      }
    }, 1000),
    [fetchContract]
  );
    

  const checkLockingTime = useCallback(async () => {
    const { ethereum } = window;
  
    if (typeof ethereum !== 'undefined' && ethereum.isMetaMask) {
      try {
        const [account] = await ethereum.request({ method: 'eth_accounts' });
  
        const susContract = await fetchContract();
        const lockingDetails = await susContract.methods.getLockedDetails(account).call() as { amount: string, blocksRemaining: string };
  
        // Ensure lockingDetails has the expected structure before accessing its properties
        if ('amount' in lockingDetails && 'blocksRemaining' in lockingDetails) {
          const { amount, blocksRemaining } = lockingDetails;
  
          // Convert amount to a BigNumber and then to tokens
          //const lockedAmountInWei = Web3.utils.toBN(amount);
          const lockedAmountInTokens = parseFloat(Web3.utils.fromWei(amount, 'ether'));
  
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
  
          setLockingTime(parseFloat((parseInt(blocksRemaining) / 43200).toFixed(1)));
  
          await fetchSusTokenPrice();
          const blocksPerYear = 43200 * 365;
          const lockApy = (20 * (blocksPerYear / (150 * Math.sqrt(lockedAmountInTokens)))).toFixed(2);
          setLockApy(parseFloat(lockApy));
  
          if (susBalance !== null && susTokenPrice !== null && lockedAmount !== null && tokensMinted !== null) {
            setSusBalancePrice(susBalance * susTokenPrice);
            setTLVprice(lockedAmount * susTokenPrice);
            setMintedPrice(tokensMinted * susTokenPrice);
          }
        } else {
          console.error('Unexpected locking details structure:', lockingDetails);
        }
  
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
            <img src="/base.png" alt="Logobase" className="second-logo" />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: 12,
              }}
            >
              <ConnectButton />
        </div>
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
  );
}

export default App;