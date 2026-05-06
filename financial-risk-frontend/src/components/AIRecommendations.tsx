import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, ChevronDown, ChevronUp, TrendingUp, Shield, DollarSign, BarChart2, Settings } from 'lucide-react';
import api from '../api/axios.ts';

interface Recommendation {
  title:           string;
  description:     string;
  priority:        'high' | 'medium' | 'low';
  category:        string;
  metric_affected: string;
}

interface AdviceResult {
  ticker:          string;
  company_name:    string;
  risk_label:      string;
  quarter_date:    string;
  recommendations: Recommendation[];
  model:           string;
  generated_at:    string;
}

interface Props {
  ticker:    string;
  riskLabel: string;
}

const priorityStyle = (priority: string) => {
  switch (priority) {
    case 'high':   return { badge: 'bg-red-500/15 text-red-400 border border-red-500/30',    dot: 'bg-red-400' };
    case 'medium': return { badge: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30', dot: 'bg-yellow-400' };
    default:       return { badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/30', dot: 'bg-blue-400' };
  }
};

const categoryIcon = (category: string) => {
  switch (category) {
    case 'liquidity':     return <BarChart2 className="w-4 h-4 text-blue-400" />;
    case 'leverage':      return <Shield className="w-4 h-4 text-purple-400" />;
    case 'profitability': return <DollarSign className="w-4 h-4 text-green-400" />;
    case 'growth':        return <TrendingUp className="w-4 h-4 text-teal-400" />;
    default:              return <Settings className="w-4 h-4 text-gray-400" />;
  }
};

export default function AIRecommendations({ ticker, riskLabel }: Props) {
  const [result,   setResult]   = useState<AdviceResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const generate = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.post(`/advice/${ticker}`);
      setResult(res.data);
    } catch (err: any) {
      setError(
        err.response?.data?.message ??
        err.response?.data?.detail ??
        'Failed to generate recommendations. Make sure FastAPI is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">AI Risk Advisor</h3>
            <p className="text-gray-500 text-xs">Powered by Llama 3.1 via Groq</p>
          </div>
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-colors"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> {result ? 'Regenerate' : 'Get AI Advice'}</>
          )}
        </button>
      </div>

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-gray-400 text-sm">Click "Get AI Advice" to generate personalized recommendations</p>
          <p className="text-gray-600 text-xs mt-1">Based on the current risk assessment and financial ratios</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Analyzing financial data...</p>
          <p className="text-gray-600 text-xs mt-1">Llama 3.1 is reviewing the risk drivers and ratios</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-3">

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b border-gray-800">
            <span>
              {result.recommendations.length} recommendations · {result.quarter_date?.split('T')[0]}
            </span>
            <span>{new Date(result.generated_at).toLocaleTimeString()}</span>
          </div>

          {/* Recommendation cards */}
          {result.recommendations.map((rec, i) => {
            const ps    = priorityStyle(rec.priority);
            const isOpen = expanded === i;
            return (
              <div
                key={i}
                className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : i)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-800/80 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${ps.dot}`} />
                  <div className="shrink-0">{categoryIcon(rec.category)}</div>
                  <p className="text-white text-sm font-medium flex-1">{rec.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ps.badge}`}>
                    {rec.priority}
                  </span>
                  {isOpen
                    ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                  }
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-gray-700/50 pt-3">
                    <p className="text-gray-300 text-sm leading-relaxed mb-3">{rec.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-500 text-xs">Metric:</span>
                      <span className="text-blue-400 text-xs font-mono bg-blue-500/10 px-2 py-0.5 rounded">
                        {rec.metric_affected}
                      </span>
                      <span className="text-gray-500 text-xs ml-1">Category:</span>
                      <span className="text-gray-400 text-xs capitalize">{rec.category}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Disclaimer */}
          <p className="text-gray-600 text-xs text-center pt-1">
            AI-generated advice for informational purposes only. Not financial advice.
          </p>
        </div>
      )}
    </div>
  );
}
