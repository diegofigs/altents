export function SplashScreen() {
  return (
    <div className="min-h-[calc(100vh-126px)] flex flex-col items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600">
      <div className="flex items-center justify-center mb-4">
        <svg
          className="animate-spin h-12 w-12 text-gray-100"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          ></path>
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-100 mb-2">Loading Assets</h2>
      <p className="text-gray-100">
        Please wait while we prepare your experience...
      </p>
    </div>
  );
}
