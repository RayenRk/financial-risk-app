import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import api from "../api/axios.ts";

interface TickerSuggestion {
  ticker: string;
  name: string;
  sector: string;
  exchange: string;
  type: string;
}

interface TickerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (ticker: string) => void;
  onAnalyze: () => void;
  loading: boolean;
}

export default function TickerAutocomplete({
  value,
  onChange,
  onSelect,
  onAnalyze,
  loading,
}: TickerAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [justSelected, setJustSelected] = useState(false); // ← prevents reopen after select

  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
      const results = res.data.results ?? [];
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounce — only search if user typed (not after programmatic select)
  useEffect(() => {
    if (justSelected) {
      setJustSelected(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      if (e.key === "Enter") onAnalyze();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        handleSelect(suggestions[activeIndex].ticker);
      } else {
        setShowSuggestions(false);
        onAnalyze();
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleSelect = (ticker: string) => {
    setJustSelected(true); // ← block next search trigger
    setShowSuggestions(false); // ← close dropdown immediately
    setSuggestions([]);
    setActiveIndex(-1);
    onSelect(ticker); // ← notify parent
  };

  return (
    <div ref={wrapperRef} className="flex-1 relative">
      {/* Search icon — only show when not searching */}
      {!searching && (
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 z-10" />
      )}

      {/* Spinner — only show when fetching suggestions */}
      {searching && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
        </div>
      )}

      {/* Input */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() =>
          !justSelected &&
          value &&
          suggestions.length > 0 &&
          setShowSuggestions(true)
        }
        placeholder="Search any company or ticker (e.g. Beyond Meat, SAP, INFY)"
        className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm"
        autoComplete="off"
        disabled={loading}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={`${s.ticker}-${i}`}
              onMouseDown={(e) => e.preventDefault()} // ← prevent input blur before click fires
              onClick={() => handleSelect(s.ticker)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-700/50 last:border-0 ${
                i === activeIndex ? "bg-blue-600/20" : "hover:bg-gray-700/50"
              }`}
            >
              <span className="font-mono font-bold text-white text-sm w-16 shrink-0">
                {s.ticker}
              </span>
              <span className="text-gray-300 text-sm truncate flex-1">
                {s.name}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {s.sector && (
                  <span className="text-gray-500 text-xs hidden sm:block">
                    {s.sector}
                  </span>
                )}
                {s.exchange && (
                  <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                    {s.exchange}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
