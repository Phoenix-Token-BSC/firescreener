"use client";

import { useState, useEffect } from "react";

interface BurnTransaction {
  from: string;
  to: string;
  amount: number;
  timestamp: string;
  transactionHash: string;
}

interface BurnHistoryResponse {
  symbol: string;
  contractAddress: string;
  // burnAddresses: string[]; // Not returned by API currently
  burnHistory: BurnTransaction[];
  lastUpdated: string;
}

interface BurnsDisplayProps {
  contractAddress: string;
  chain: string;
}

export default function BurnsDisplay({ contractAddress }: BurnsDisplayProps) {
  const [burns, setBurns] = useState<BurnTransaction[]>([]);
  const [tokenSymbol, setTokenSymbol] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const MAX_RETRIES = 3;

  useEffect(() => {
    if (!contractAddress) return;

    const fetchBurns = async (attempt: number = 1) => {
      setIsLoading(true);
      setError(null);

      try {
      //  console.log(`Fetching burns for contract: ${contractAddress}, Attempt: ${attempt}`);

        const response = await fetch(`/api/bsc/burn-history/${encodeURIComponent(contractAddress)}`);
       // console.log("Response Status:", response.status);

        if (!response.ok) {
          const errorData: { error?: string; message?: string } = await response.json();
          console.error("API Error:", errorData);
          throw new Error(errorData.message || errorData.error || "Failed to fetch burn transactions");
        }

        const data: BurnHistoryResponse = await response.json();
       //  console.log("Burn Transactions Data:", data);

        // Map API response to state
        setBurns(data.burnHistory || []);
        setTokenSymbol(data.symbol || '');
        setIsLoading(false);
      } catch (err: unknown) {
        console.error(`Fetch Error (Attempt ${attempt}):`, (err as Error).message);

        if (attempt < MAX_RETRIES) {
          // Retry with exponential backoff
          const delay = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s
         // console.log(`Retrying in ${delay / 1000} seconds...`);
          setTimeout(() => fetchBurns(attempt + 1), delay);
        } else {
          setError((err as Error).message);
          setIsLoading(false);
        }
      }
    };

    fetchBurns();
  }, [contractAddress]);

  const truncateAddress = (address?: string): string => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const formatAmount = (amount: number): string => {
    // Format large numbers with commas
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(2) + "M";
    } else if (amount >= 1000) {
      return (amount / 1000).toFixed(2) + "K";
    }
    return amount.toFixed(2);
  };

  if (isLoading) return <div className="text-center">Loading burns...</div>;
  if (error) return <div className="text-center text-red-500">Error: {error}</div>;
  if (!burns || burns.length === 0) return <div className="text-center">No burn transactions found</div>;

  return (
    <div className="md:py-0 py-8">
      <h2 className="text-2xl font-bold mb-2">Recent Burns</h2>

      <div className="hidden md:flex md:flex-row justify-center gap-32 h-96 overflow-y-auto rounded">
        <ul className="w-full">
          <li className="flex justify-between py-2 font-semibold border-b gap-8">
            <span className="text-sm">Time</span>
            <span className="text-sm">From Address</span>
            <span className="text-sm text-right pr-2">Amount</span>
          </li>

          {burns.map((burn, index) => (
            <li key={`${burn.transactionHash}-${index}`} className="flex justify-between gap-8 py-2 border-b hover:bg-gray-50">
              <span className="text-sm">{burn.timestamp}</span>
              <a
                href={`https://bscscan.com/address/${burn.from}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-orange-500 hover:underline"
              >
                {truncateAddress(burn.from)}
              </a>
              <span className="text-sm pr-2 text-right">
                {formatAmount(burn.amount)} {tokenSymbol}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="md:hidden h-96 overflow-y-auto rounded">
        <ul>
          {burns.map((burn, index) => (
            <li key={`${burn.transactionHash}-${index}`} className="flex flex-col py-2 border-b gap-1">
              <div className="flex justify-between">
                <span className="text-sm font-semibold">Time:</span>
                <span className="text-sm">{burn.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold">From:</span>
                <a
                  href={`https://bscscan.com/address/${burn.from}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white hover:underline"
                >
                  {truncateAddress(burn.from)}
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold">Amount:</span>
                <span className="text-sm text-orange-500 text-right">
                  {formatAmount(burn.amount)} {tokenSymbol.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold">Tx:</span>
                <a
                  href={`https://bscscan.com/tx/${burn.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white hover:underline"
                >
                  {truncateAddress(burn.transactionHash)}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}