import type { Metadata } from "next";
import { getTokenByAddress, getTokenBySymbol } from "@/lib/tokenRegistry";

type Props = {
  params: Promise<{
    chain: string;
    contractAddress: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chain, contractAddress } = await params;

  // Try to get token by address first, then by symbol
  let token = getTokenByAddress(contractAddress);

  // If not found by address, try by symbol with chain filter
  if (!token) {
    token = getTokenBySymbol(contractAddress, chain as 'bsc' | 'sol' | 'rwa' | 'eth');
  }

  // Default metadata if token not found
  if (!token) {
    return {
      title: `${contractAddress} | FireScreener`,
      description: `Check out ${contractAddress} on FireScreener`,
    };
  }

  // Build base URL for absolute paths
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://firescreener.com';
  const pageUrl = `${baseUrl}/${chain}/${contractAddress}`;
  const logoUrl = `${baseUrl}/api/${chain}/logo/${contractAddress}`;

  // Basic metadata
  const title = `${token.symbol.toUpperCase()} | ${token.name}`;
  let description = `${token.name} (${token.symbol.toUpperCase()}) on ${chain.toUpperCase()}`;

  // Try to fetch price data for enhanced description
  try {
    const priceResponse = await fetch(`${baseUrl}/api/${chain}/token-price/${contractAddress}`, {
      next: { revalidate: 60 } // Cache for 1 minute
    });

    if (priceResponse.ok) {
      const priceData = await priceResponse.json();

      // Format numbers for display
      const formatPrice = (price: string | number): string => {
        const num = parseFloat(price.toString());
        if (isNaN(num)) return 'N/A';

        if (num < 0.000001) {
          return num.toExponential(4);
        } else if (num < 1) {
          return num.toFixed(6).replace(/\.?0+$/, '');
        }
        return num.toFixed(4).replace(/\.?0+$/, '');
      };

      const formatLarge = (value: string | number): string => {
        const num = parseFloat(value.toString());
        if (isNaN(num) || num === 0) return 'N/A';

        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
        return `$${num.toFixed(2)}`;
      };

      const price = formatPrice(priceData.price);
      const marketCap = formatLarge(priceData.marketCap);
      const liquidity = formatLarge(priceData.liquidity);

      description = `${token.name} (${token.symbol.toUpperCase()}) • Price: $${price} • Market Cap: ${marketCap} • Liquidity: ${liquidity}`;
    }
  } catch (error) {
    console.error('Failed to fetch token data for metadata:', error);
    // Continue with basic description if fetch fails
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: 'FireScreener',
      images: [
        {
          url: logoUrl,
          width: 1200,
          height: 630,
          alt: `${token.name} Logo`,
        }
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [logoUrl],
    },
  };
}

export default function TokenLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
