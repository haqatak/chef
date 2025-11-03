import React from 'react';

interface ErrorDisplayProps {
  error: Error | unknown;
  resetErrorBoundary?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, resetErrorBoundary }) => {
  const isError = error instanceof Error;
  
  // Try to extract meaningful error information
  let errorMessage: string;
  let errorDetails: string | null = null;
  
  if (isError) {
    errorMessage = error.message;
  } else if (typeof error === 'object' && error !== null) {
    // Try to stringify the object to see what's in it
    try {
      errorDetails = JSON.stringify(error, null, 2);
      errorMessage = 'An error object was thrown (see details below)';
    } catch {
      errorMessage = 'An unknown error object was thrown';
    }
  } else {
    errorMessage = String(error);
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-red-800">An error occurred</h2>
        <div className="mt-2 text-red-700">{errorMessage}</div>
      </div>

      {errorDetails && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-red-800">Error details:</h3>
          <pre className="mt-2 overflow-auto rounded bg-gray-100 p-3 font-mono text-xs text-gray-800">
            {errorDetails}
          </pre>
        </div>
      )}

      {isError && error.stack && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-red-800">Stack trace:</h3>
          <pre className="mt-2 overflow-auto rounded bg-gray-100 p-3 font-mono text-xs text-gray-800">
            {error.stack}
          </pre>
        </div>
      )}

      {resetErrorBoundary && (
        <button
          onClick={resetErrorBoundary}
          className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/50"
        >
          Try again
        </button>
      )}
    </div>
  );
};
