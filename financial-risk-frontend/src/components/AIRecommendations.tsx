import { useState } from 'react';
import {
  Sparkles, Loader2, AlertCircle, ChevronDown, ChevronUp,
  TrendingUp, Shield, DollarSign, BarChart2, Settings,
  Target, Activity, Building2, UserCog,
} from 'lucide-react';
import api from '../api/axios.ts';

interface Recommendation {
  title:           string;
  description:     string;
  priority:        'high' | 'medium' | 'low';
  category:        string;
  metric_affected: string;
  current_value:   string;
  target_value:    string;
  benchmark:       string;
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

type Tab = 'company' | 'analyst';

const priorityStyle = (priority: string) => {
  switch (priority) {
    case 'high':   return {
      badge: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30',
      dot: 'bg-red-500', label: 'Immediate',
    };
    case 'medium': return {
      badge: 'bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/30',
      dot: 'bg-yellow-500', label: 'Next Quarter',
    };
    default: return {
      badge: 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30',
      dot: 'bg-blue-500', label: 'Strategic',
    };
  }
};

const categoryIcon = (category: string) => {
  switch (category) {
    case 'liquidity':     return <BarChart2   className="w-4 h-4 text-blue-500 dark:text-blue-400" />;
    case 'leverage':      return <Shield       className="w-4 h-4 text-purple-500 dark:text-purple-400" />;
    case 'profitability': return <DollarSign   className="w-4 h-4 text-green-500 dark:text-green-400" />;
    case 'growth':        return <TrendingUp   className="w-4 h-4 text-teal-500 dark:text-teal-400" />;
    default:              return <Settings     className="w-4 h-4 text-gray-500 dark:text-gray-400" />;
  }
};

function RecommendationList({ result, emptyHint }: { result: AdviceResult; emptyHint: string }) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const recommendations = result?.recommendations ?? [];

  return (
    <div className="space-y-3">
      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pb-3 border-b border-gray-100 dark:border-gray-800">
        <span>{recommendations.length} recommendations · {result.quarter_date?.split('T')[0]}</span>
        <span>{new Date(result.generated_at).toLocaleTimeString()}</span>
      </div>

      {/* Priority legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500 pb-1">
        {[
          { dot: 'bg-red-500',    label: 'Immediate' },
          { dot: 'bg-yellow-500', label: 'Next Quarter' },
          { dot: 'bg-blue-500',   label: 'Strategic' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${l.dot}`} />
            <span>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Cards */}
      {recommendations.map((rec, i) => {
        const ps     = priorityStyle(rec.priority);
        const isOpen = expanded === i;
        return (
          <div key={i} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : i)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-colors"
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${ps.dot}`} />
              <div className="shrink-0">{categoryIcon(rec.category)}</div>
              <p className="text-gray-900 dark:text-white text-sm font-medium flex-1">{rec.title}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ps.badge}`}>{ps.label}</span>
              {isOpen
                ? <ChevronUp   className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
              }
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-3 border-t border-gray-200 dark:border-gray-700/50 space-y-3">
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{rec.description}</p>

                {/* Metrics strip */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { Icon: Activity,  label: 'Current',          value: rec.current_value, cls: 'text-gray-900 dark:text-white' },
                    { Icon: Target,    label: 'Reversal Trigger',  value: rec.target_value,  cls: 'text-green-600 dark:text-green-400' },
                    { Icon: BarChart2, label: 'Benchmark',         value: rec.benchmark,     cls: 'text-blue-600 dark:text-blue-400' },
                  ].map(({ Icon, label, value, cls }) => (
                    <div key={label} className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <p className="text-gray-400 dark:text-gray-500 text-xs mb-1 flex items-center gap-1">
                        <Icon className="w-3 h-3" /> {label}
                      </p>
                      <p className={`font-bold text-sm font-mono ${cls}`}>{value || '—'}</p>
                    </div>
                  ))}
                </div>

                {/* Tags */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-400 dark:text-gray-500 text-xs">Metric:</span>
                  <span className="text-blue-600 dark:text-blue-400 text-xs font-mono bg-blue-100 dark:bg-blue-500/10 px-2 py-0.5 rounded capitalize">
                    {rec.metric_affected}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500 text-xs ml-1">Category:</span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs capitalize">{rec.category}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <p className="text-gray-400 dark:text-gray-600 text-xs text-center pt-1">{emptyHint}</p>
    </div>
  );
}

export default function AIRecommendations({ ticker, riskLabel }: Props) {
  const [activeTab,       setActiveTab]       = useState<Tab>('company');
  const [companyResult,   setCompanyResult]   = useState<AdviceResult | null>(null);
  const [analystResult,   setAnalystResult]   = useState<AdviceResult | null>(null);
  const [companyLoading,  setCompanyLoading]  = useState(false);
  const [analystLoading,  setAnalystLoading]  = useState(false);
  const [companyError,    setCompanyError]    = useState('');
  const [analystError,    setAnalystError]    = useState('');

  const generateCompany = async () => {
    setCompanyLoading(true);
    setCompanyError('');
    setCompanyResult(null);
    try {
      const res = await api.post(`/advice/${ticker}`);
      setCompanyResult(res.data);
    } catch (err: any) {
      setCompanyError(err.response?.data?.message ?? err.response?.data?.detail ?? 'Failed. Is FastAPI running?');
    } finally {
      setCompanyLoading(false);
    }
  };

  const generateAnalyst = async () => {
    setAnalystLoading(true);
    setAnalystError('');
    setAnalystResult(null);
    try {
      const res = await api.post(`/advice/${ticker}/analyst`);
      setAnalystResult(res.data);
    } catch (err: any) {
      setAnalystError(err.response?.data?.message ?? err.response?.data?.detail ?? 'Failed. Is FastAPI running?');
    } finally {
      setAnalystLoading(false);
    }
  };

  const tabs: { key: Tab; label: string; Icon: any; desc: string }[] = [
    { key: 'company', Icon: Building2, label: 'Company Actions',  desc: 'What the company should fix internally' },
    { key: 'analyst', Icon: UserCog,   label: 'My Action Plan',   desc: 'What you as analyst/admin should do' },
  ];

  const loading = activeTab === 'company' ? companyLoading : analystLoading;
  const error   = activeTab === 'company' ? companyError   : analystError;
  const result  = activeTab === 'company' ? companyResult  : analystResult;
  const generate = activeTab === 'company' ? generateCompany : generateAnalyst;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-600/20 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-gray-900 dark:text-white font-semibold">AI Risk Advisor</h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs">Powered by Llama 3.1 via Groq</p>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-colors"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
            : <><Sparkles className="w-4 h-4" /> {result ? 'Regenerate' : 'Get AI Advice'}</>
          }
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {tabs.map(({ key, Icon, label, desc }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left transition-colors ${
              activeTab === key
                ? 'bg-purple-50 dark:bg-purple-600/10 border-purple-200 dark:border-purple-500/30'
                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${activeTab === key ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}`} />
            <div>
              <p className={`text-sm font-medium ${activeTab === key ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}`}>
                {label}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-gray-300 dark:text-gray-600" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {activeTab === 'company'
              ? 'Get actionable fixes the company should implement'
              : 'Get a personalized action plan for you as analyst / decision-maker'}
          </p>
          <p className="text-gray-400 dark:text-gray-600 text-xs mt-1">
            Based on actual ratios vs IT sector benchmarks
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {activeTab === 'company' ? 'Analyzing company financials...' : 'Building your action plan...'}
          </p>
          <p className="text-gray-400 dark:text-gray-600 text-xs mt-1">
            Comparing ratios against IT sector benchmarks
          </p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <RecommendationList
          result={result}
          emptyHint={
            activeTab === 'company'
              ? 'Data-driven fixes based on actual ratios vs IT sector benchmarks. Not financial advice.'
              : 'Analyst action plan based on ML risk signals and financial ratios. Not investment advice.'
          }
        />
      )}
    </div>
  );
}
