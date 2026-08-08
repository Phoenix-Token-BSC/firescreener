"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRegistry, findBySymbol } from "@/hooks/useRegistry";

function ErrorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registry = useRegistry();
  const errorType = searchParams.get('type');
  const identifier = searchParams.get('identifier');
  const chain = searchParams.get('chain');

  const getErrorMessage = () => {
    switch (errorType) {
      case 'invalid_address':
        return `Invalid contract address format for ${chain?.toUpperCase() || 'the specified chain'}.`;
      case 'token_not_found':
        return `Token not found: ${identifier}`;
      case 'chain_mismatch':
        return `Token is not available on ${chain?.toUpperCase() || 'the specified chain'}.`;
      case 'duplicate_symbol':
        return `Multiple tokens found with symbol "${identifier}" on ${chain?.toUpperCase()}. Please use the specific contract address instead.`;
      default:
        return 'The token or chain you requested is invalid or unavailable.';
    }
  };

  const getDefaultTokenUrl = () => {
    const phtToken = findBySymbol(registry, 'pht');
    return phtToken ? `/${phtToken.chain}/${phtToken.address}` : '/';
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-red-500 text-2xl font-bold">Oops! Something went wrong.</h1>
      <p className="mt-2 text-gray-700 text-center max-w-md">{getErrorMessage()}</p>

      {identifier && (
        <p className="mt-2 text-sm text-gray-500">
          Searched for: <code className="bg-gray-200 px-2 py-1 rounded">{identifier}</code>
        </p>
      )}

      {errorType === 'duplicate_symbol' && identifier && chain && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md">
          <h3 className="font-semibold text-yellow-800 mb-2">Available tokens with symbol &quot{identifier}&quot:</h3>
          <div className="space-y-2">
            {registry
              .filter(token => token.symbol.toLowerCase() === identifier.toLowerCase())
              .filter(token => token.chain === chain)
              .map(token => (
                <div key={token.address} className="flex flex-col">
                  <button
                    onClick={() => router.push(`/${token.chain}/${token.address}`)}
                    className="text-left p-2 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">{token.name}</div>
                    <div className="text-sm text-gray-600">{token.address}</div>
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        <button
          onClick={() => router.push(getDefaultTokenUrl())}
          className="block bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded transition-colors"
        >
          Go to PHT (Default Token)
        </button>
        <button
          onClick={() => router.push('/')}
          className="block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded transition-colors"
        >
          View All Tokens
        </button>
        <button
          onClick={() => router.back()}
          className="block text-orange-600 hover:text-orange-700 underline transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <ErrorPageContent />
    </Suspense>
  );
}