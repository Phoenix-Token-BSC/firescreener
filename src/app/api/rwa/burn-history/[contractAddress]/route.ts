import { NextRequest, NextResponse } from 'next/server';
import { getTokenByAddress, isValidContractAddress } from '@/lib/tokenRegistry';

interface RouteParams {
  contractAddress: string;
}

// Define proper types for BSCScan API responses
type BscscanApiResponse = {
    status: string;
    message: string;
    result: BscscanTransaction[] | string; // result can be a string when there's an error
};

type BscscanTransaction = {
    blockNumber: string;
    timeStamp: string;
    hash: string;
    nonce: string;
    blockHash: string;
    from: string;
    contractAddress: string;
    to: string;
    value: string;
    tokenName: string;
    tokenSymbol: string;
    tokenDecimal: string;
    transactionIndex: string;
    gas: string;
    gasPrice: string;
    gasUsed: string;
    cumulativeGasUsed: string;
    input: string;
    confirmations: string;
};

type FormattedTransaction = {
    from: string;
    to: string;
    amount: number;
    timestamp: string;
    transactionHash: string;
};

// Environment variables
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const BSCSCAN_API_URL = "https://scan.assetchain.org/api/v2/stats";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

/**
 * Format a timestamp to a human-readable "time ago" string
 */
function formatTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);

    interface TimeInterval {
        label: string;
        seconds: number;
    }

    const intervals: TimeInterval[] = [
        { label: "year", seconds: 31536000 },
        { label: "month", seconds: 2592000 },
        { label: "week", seconds: 604800 },
        { label: "day", seconds: 86400 },
        { label: "hour", seconds: 3600 },
        { label: "minute", seconds: 60 },
        { label: "second", seconds: 1 },
    ];

    for (const interval of intervals) {
        const count = Math.floor(diffInSeconds / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label}${count > 1 ? "s" : ""} ago`;
        }
    }

    return "just now";
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  try {
   // console.log('Starting burn history API call...');
    
    const params = await context.params;
    const { contractAddress } = params;
    //console.log('Contract address:', contractAddress);

    if (!contractAddress) {
     // console.log('Missing contract address');
      return NextResponse.json({ error: 'Missing contract address' }, { status: 400 });
    }

    const addressLower = contractAddress.toLowerCase();
    //console.log('Normalized address:', addressLower);

    // Validate contract address format
    try {
      if (!isValidContractAddress(addressLower, 'bsc')) {
       // console.log('Invalid contract address format');
        return NextResponse.json({ error: 'Invalid contract address format' }, { status: 400 });
      }
    } catch (validationError) {
      console.error('Error validating contract address:', validationError);
      return NextResponse.json({ error: 'Error validating contract address' }, { status: 500 });
    }

    // Verify token exists in registry
    let tokenMetadata;
    try {
      tokenMetadata = getTokenByAddress(addressLower);
     // console.log('Token metadata:', tokenMetadata);
    } catch (registryError) {
      console.error('Error fetching token from registry:', registryError);
      return NextResponse.json({ error: 'Error accessing token registry' }, { status: 500 });
    }

    if (!tokenMetadata) {
    //  console.log('Token not found in registry');
      return NextResponse.json({ error: 'Token not found in registry' }, { status: 404 });
    }

    // Verify it's a BSC token
    if (tokenMetadata.chain !== 'bsc') {
     // console.log(`Token is on ${tokenMetadata.chain}, not BSC`);
      return NextResponse.json({
        error: `Token is on ${tokenMetadata.chain.toUpperCase()}, not BSC`
      }, { status: 400 });
    }

    // Validate API key
    if (!BSCSCAN_API_KEY) {
      console.error("Missing BSCSCAN_API_KEY environment variable");
      return NextResponse.json(
        { error: "Server configuration error", message: "API key not configured" },
        { status: 500 }
      );
    }

    // Fetch burn transactions from BSCScan API
    const url = `${BSCSCAN_API_URL}&module=account&action=tokentx&contractaddress=${contractAddress}&address=${DEAD_ADDRESS}&sort=desc&offset=50&page=1&apikey=${BSCSCAN_API_KEY}`;
   // console.log('Fetching from BSCScan URL:', url);

    let response;
    let data: BscscanApiResponse;
    
    try {
      response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BurnTracker/1.0'
        }
      });

      if (!response.ok) {
        console.error(`BSCScan API HTTP error: ${response.status} ${response.statusText}`);
        return NextResponse.json(
          { error: "BSCScan API request failed", message: `HTTP ${response.status}` },
          { status: 500 }
        );
      }

      data = await response.json() as BscscanApiResponse;
      //console.log('BSCScan API response status:', data.status);
      //console.log('BSCScan API message:', data.message);
      
    } catch (fetchError) {
      console.error("Error fetching from BSCScan:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch from BSCScan", message: (fetchError as Error).message },
        { status: 500 }
      );
    }

    // Handle BSCScan API errors or empty results
    if (data.status !== "1") {
      if (data.message === "No transactions found") {
      //  console.log('No burn transactions found for this token');
        // Return empty results instead of error
        const burnData = {
          contractAddress: contractAddress,
          symbol: tokenMetadata.symbol,
          name: tokenMetadata.name,
          burnHistory: [],
          totalBurnEvents: 0,
          totalBurned: "0",
          lastUpdated: new Date().toISOString()
        };
        return NextResponse.json(burnData);
      }
      
      console.error("BSCScan API error:", data.message);
      return NextResponse.json(
        { error: "Failed to fetch burn transactions", message: data.message },
        { status: 500 }
      );
    }

    // Check if result is an array (successful response) or string (error)
    if (!Array.isArray(data.result)) {
      console.error("Unexpected BSCScan response format:", data.result);
      return NextResponse.json(
        { error: "Unexpected API response format", message: "Invalid response structure" },
        { status: 500 }
      );
    }

   //  console.log(`Found ${data.result.length} burn transactions`);

    // Format the transactions with better error handling
    const transactions: FormattedTransaction[] = [];
    
    for (const tx of data.result) {
      try {
        // Ensure values are properly converted with validation
        const tokenDecimal = parseInt(tx.tokenDecimal) || 0;
        const txValue = tx.value || "0";
        const timeStamp = parseInt(tx.timeStamp) || 0;

        // Handle potential conversion issues with safe parsing
        let amount = 0;
        try {
          if (tokenDecimal > 0 && txValue !== "0") {
            const divisor = Math.pow(10, tokenDecimal);
            amount = parseFloat(txValue) / divisor;
            
            // Validate the result
            if (!isFinite(amount) || isNaN(amount)) {
              amount = 0;
            }
          }
        } catch (amountError) {
          console.warn('Error calculating amount for tx:', tx.hash, amountError);
          amount = 0;
        }

        const txTimestamp = timeStamp > 0 ? new Date(timeStamp * 1000) : new Date();

        transactions.push({
          from: tx.from || '',
          to: tx.to || '',
          amount: amount,
          timestamp: formatTimeAgo(txTimestamp),
          transactionHash: tx.hash || '',
        });

      } catch (txError) {
        console.warn('Error processing transaction:', tx.hash, txError);
        // Continue processing other transactions
      }
    }

    // Calculate total burned with safe math
    const totalBurned = transactions.reduce((sum: number, burn: FormattedTransaction) => {
      const amount = burn.amount || 0;
      return sum + (isFinite(amount) ? amount : 0);
    }, 0);

    const burnData = {
      contractAddress: contractAddress,
      symbol: tokenMetadata.symbol,
      name: tokenMetadata.name,
      burnHistory: transactions,
      totalBurnEvents: transactions.length,
      totalBurned: totalBurned.toString(),
      lastUpdated: new Date().toISOString()
    };

    // console.log('Successfully processed burn data:', {
    //   totalEvents: burnData.totalBurnEvents,
    //   totalBurned: burnData.totalBurned
    // });

    return NextResponse.json(burnData);

  } catch (error) {
    // Enhanced error logging
    const typedError = error as Error;
    console.error("Burn history API error:", {
      message: typedError.message,
      stack: typedError.stack,
      name: typedError.name
    });

    return NextResponse.json(
      { 
        error: "Failed to fetch burn history", 
        message: typedError.message,
        ...(process.env.NODE_ENV === 'development' && { stack: typedError.stack })
      },
      { status: 500 }
    );
  }
}