"use client";

interface AwardInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function AwardInput({
  value,
  onChange,
  onSubmit,
  isLoading,
}: AwardInputProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <label
        htmlFor="awards"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        Enter award names (one per line or comma-separated)
      </label>
      <textarea
        id="awards"
        rows={5}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-y"
        placeholder={"Cannes Lions\nEffie Awards\nMumbrella CommsCon Awards"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
      />
      <button
        onClick={onSubmit}
        disabled={isLoading || !value.trim()}
        className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Researching...
          </span>
        ) : (
          "Research Awards"
        )}
      </button>
    </div>
  );
}
