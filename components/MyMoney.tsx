import React, { useState, useMemo } from 'react';
import { 
  Wallet, ArrowUpRight, ArrowDownRight, Plus, Trash2, Calendar, 
  Tag, CreditCard, PieChart, ShieldAlert, Check, DollarSign, 
  ChevronLeft, ChevronRight, Filter, Search, Repeat, Sparkles, TrendingUp, TrendingDown, Layers
} from 'lucide-react';
import { MoneyTransaction, TransactionType, TransactionCategory } from '../types';

interface MyMoneyProps {
  transactions: MoneyTransaction[];
  onSaveTransactions: (updated: MoneyTransaction[]) => void;
}

export const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; type: 'income' | 'expense' | 'both' }> = {
  stipendio: { label: 'Stipendio', icon: '💼', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20', type: 'income' },
  extra_lavoro: { label: 'Extra & Turni', icon: '⚡', color: 'text-cyan-500', bg: 'bg-cyan-500/10 border-cyan-500/20', type: 'income' },
  altre_entrate: { label: 'Altre Entrate', icon: '🎁', color: 'text-teal-500', bg: 'bg-teal-500/10 border-teal-500/20', type: 'income' },
  casa_bollette: { label: 'Casa & Bollette', icon: '🏠', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20', type: 'expense' },
  spesa_cibo: { label: 'Spesa & Cibo', icon: '🛒', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20', type: 'expense' },
  trasporti_auto: { label: 'Trasporti & Auto', icon: '🚗', color: 'text-indigo-500', bg: 'bg-indigo-500/10 border-indigo-500/20', type: 'expense' },
  svago_tempo_libero: { label: 'Svago & Ristoranti', icon: '🎉', color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/20', type: 'expense' },
  salute_benessere: { label: 'Salute & Benessere', icon: '💊', color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20', type: 'expense' },
  shopping: { label: 'Shopping', icon: '🛍️', color: 'text-pink-500', bg: 'bg-pink-500/10 border-pink-500/20', type: 'expense' },
  risparmi_investimenti: { label: 'Risparmi & Fondo', icon: '🐷', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', type: 'both' },
  abbonamenti: { label: 'Abbonamenti & Servizi', icon: '📱', color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20', type: 'expense' },
  altro: { label: 'Altro', icon: '📦', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', type: 'both' },
};

export const MyMoney: React.FC<MyMoneyProps> = ({ transactions, onSaveTransactions }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState<TransactionType>('expense');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TransactionCategory>('spesa_cibo');
  const [date, setDate] = useState(new Date().toLocaleDateString('fr-CA'));
  const [isRecurring, setIsRecurring] = useState(false);
  const [note, setNote] = useState('');
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Month navigation helpers
  const monthDate = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }, [selectedMonth]);

  const handlePrevMonth = () => {
    const prev = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
    setSelectedMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
    setSelectedMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  // Filter transactions for current month
  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => t.date && t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // Statistics
  const { totalIncome, totalExpense, netBalance, categoryTotals, savingsRate } = useMemo(() => {
    let income = 0;
    let expense = 0;
    const catMap: Record<string, number> = {};

    monthlyTransactions.forEach(t => {
      const val = Number(t.amount) || 0;
      if (t.type === 'income') {
        income += val;
      } else {
        expense += val;
        catMap[t.category] = (catMap[t.category] || 0) + val;
      }
    });

    const net = income - expense;
    const rate = income > 0 ? Math.max(0, Math.min(100, Math.round((net / income) * 100))) : 0;

    return {
      totalIncome: income,
      totalExpense: expense,
      netBalance: net,
      categoryTotals: catMap,
      savingsRate: rate
    };
  }, [monthlyTransactions]);

  // Filtered transactions list
  const filteredTransactions = useMemo(() => {
    return monthlyTransactions.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (selectedCategoryFilter !== 'all' && t.category !== selectedCategoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchNote = t.note?.toLowerCase().includes(q);
        const matchCat = (CATEGORY_CONFIG[t.category]?.label || '').toLowerCase().includes(q);
        return matchTitle || matchNote || matchCat;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [monthlyTransactions, filterType, selectedCategoryFilter, searchQuery]);

  // Handle Add Transaction
  const handleOpenAddModal = (type: TransactionType) => {
    setModalType(type);
    setCategory(type === 'income' ? 'stipendio' : 'spesa_cibo');
    setAmount('');
    setTitle('');
    setNote('');
    setIsRecurring(false);
    setDate(new Date().toLocaleDateString('fr-CA'));
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0 || !title.trim()) return;

    const newTx: MoneyTransaction = {
      id: crypto.randomUUID(),
      date,
      amount: numAmount,
      type: modalType,
      category,
      title: title.trim(),
      note: note.trim() || undefined,
      isRecurring
    };

    onSaveTransactions([newTx, ...transactions]);
    setShowAddModal(false);
  };

  const handleDelete = (id: string) => {
    onSaveTransactions(transactions.filter(t => t.id !== id));
    setDeleteConfirmId(null);
  };

  const monthLabel = monthDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 text-white shadow-2xl border border-white/10">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-20 -top-10 w-36 h-36 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-3">
              <Wallet size={14} /> Portafoglio Personale
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              My Money <Sparkles className="text-amber-400" size={24} />
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-md">
              Gestisci entrate, uscite e spese fisse in un unico posto. Senza vincoli, 100% in locale sul tuo dispositivo.
            </p>
          </div>

          {/* Month Selector Control */}
          <div className="flex items-center justify-between md:justify-end gap-3 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/10">
            <button 
              onClick={handlePrevMonth}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all"
              title="Mese Precedente"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-center px-3 min-w-[140px]">
              <div className="text-xs text-slate-300 font-medium uppercase tracking-wider">Mese In Esame</div>
              <div className="text-base font-bold capitalize text-white">{monthLabel}</div>
            </div>
            <button 
              onClick={handleNextMonth}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all"
              title="Mese Successivo"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Net Balance */}
        <div className={`rounded-3xl p-5 border-2 transition-all glass-card ${
          netBalance >= 0 
            ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-slate-900 border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.15)]' 
            : 'bg-gradient-to-br from-rose-950/40 via-slate-900/90 to-slate-900 border-rose-500/30 shadow-[0_0_25px_rgba(244,63,94,0.15)]'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Saldo Netto</span>
            <div className={`p-2 rounded-xl ${netBalance >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <Wallet size={18} />
            </div>
          </div>
          <div className={`text-2xl md:text-3xl font-black tracking-tight ${netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netBalance >= 0 ? '+' : ''}{netBalance.toFixed(2)} €
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            {netBalance >= 0 ? <TrendingUp size={12} className="text-emerald-400" /> : <TrendingDown size={12} className="text-rose-400" />}
            <span>{netBalance >= 0 ? 'Attivo del mese' : 'Disavanzo del mese'}</span>
          </div>
        </div>

        {/* Total Income */}
        <div className="rounded-3xl p-5 bg-slate-900/80 border-2 border-emerald-500/20 glass-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Entrate</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black tracking-tight text-emerald-400">
            +{totalIncome.toFixed(2)} €
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Stipendi, extra e incassi
          </div>
        </div>

        {/* Total Expense */}
        <div className="rounded-3xl p-5 bg-slate-900/80 border-2 border-rose-500/20 glass-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Uscite</span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <ArrowDownRight size={18} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black tracking-tight text-rose-400">
            -{totalExpense.toFixed(2)} €
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Spese fisse e variabili
          </div>
        </div>

        {/* Savings Rate */}
        <div className="rounded-3xl p-5 bg-slate-900/80 border-2 border-amber-500/20 glass-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Risparmiato</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <PieChart size={18} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black tracking-tight text-amber-400">
            {savingsRate}%
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div 
              className="bg-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleOpenAddModal('income')}
          className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-lg shadow-emerald-900/30 active:scale-95"
        >
          <Plus size={20} />
          <span>+ Aggiungi Entrata</span>
        </button>

        <button
          onClick={() => handleOpenAddModal('expense')}
          className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-lg shadow-rose-900/30 active:scale-95"
        >
          <Plus size={20} />
          <span>- Aggiungi Spesa</span>
        </button>
      </div>

      {/* Category Breakdown Progress Bars (If Expenses Exist) */}
      {Object.keys(categoryTotals).length > 0 && (
        <div className="glass-card bg-slate-900/90 rounded-3xl p-6 border-2 border-indigo-500/20 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm uppercase tracking-wider">
              <Layers size={18} /> Ripartizione Spese per Categoria
            </div>
            <span className="text-xs text-slate-400 font-medium">Totale: -{totalExpense.toFixed(2)} €</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(categoryTotals)
              .sort(([, a], [, b]) => b - a)
              .map(([catKey, sum]) => {
                const conf = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG['altro'];
                const pct = totalExpense > 0 ? Math.round((sum / totalExpense) * 100) : 0;
                return (
                  <div key={catKey} className="space-y-1.5 p-3 rounded-2xl bg-slate-800/40 border border-white/5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-2 text-slate-200">
                        <span className="text-base">{conf.icon}</span>
                        {conf.label}
                      </span>
                      <span className="text-rose-400 font-bold">-{sum.toFixed(2)} € <span className="text-slate-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Transactions List Section */}
      <div className="glass-card bg-slate-900/90 rounded-3xl p-6 border-2 border-slate-800 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="font-bold text-slate-100 text-lg flex items-center gap-2">
              <CreditCard size={20} className="text-cyan-400" />
              Movimenti di {monthLabel}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Trovati {filteredTransactions.length} movimenti nel mese selezionato
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-none min-w-[160px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca transazione..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500"
              />
            </div>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 outline-none focus:border-cyan-500"
            >
              <option value="all">Tutti i tipi</option>
              <option value="income">Solo Entrate (+)</option>
              <option value="expense">Solo Uscite (-)</option>
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 outline-none focus:border-cyan-500 max-w-[150px]"
            >
              <option value="all">Tutte le categorie</option>
              {Object.entries(CATEGORY_CONFIG).map(([k, c]) => (
                <option key={k} value={k}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* List of items */}
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <Wallet size={24} />
            </div>
            <p className="text-sm font-medium">Nessuna transazione trovata per questo periodo.</p>
            <p className="text-xs text-slate-500">Usa i pulsanti sopra per aggiungere la prima entrata o spesa.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTransactions.map(t => {
              const conf = CATEGORY_CONFIG[t.category] || CATEGORY_CONFIG['altro'];
              const isIncome = t.type === 'income';

              return (
                <div 
                  key={t.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 border ${conf.bg}`}>
                      {conf.icon}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm truncate">{t.title}</span>
                        {t.isRecurring && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-bold">
                            <Repeat size={10} /> Ricorrente
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span className="font-medium text-slate-300">{conf.label}</span>
                        <span>•</span>
                        <span>{new Date(t.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</span>
                        {t.note && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px] sm:max-w-[200px] text-slate-500 italic">{t.note}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <div className={`text-base sm:text-lg font-black tracking-tight ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isIncome ? '+' : '-'}{t.amount.toFixed(2)} €
                    </div>

                    <button
                      onClick={() => setDeleteConfirmId(t.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-80 sm:opacity-0 group-hover:opacity-100"
                      title="Elimina"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-card bg-slate-900 rounded-3xl p-6 max-w-lg w-full border-2 border-slate-700 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                {modalType === 'income' ? (
                  <span className="text-emerald-400 flex items-center gap-2"><ArrowUpRight size={22} /> Nuova Entrata</span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-2"><ArrowDownRight size={22} /> Nuova Spesa</span>
                )}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 bg-slate-800/80 p-1 rounded-2xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => { setModalType('income'); setCategory('stipendio'); }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    modalType === 'income' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  + Entrata
                </button>
                <button
                  type="button"
                  onClick={() => { setModalType('expense'); setCategory('spesa_cibo'); }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    modalType === 'expense' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  - Spesa / Uscita
                </button>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Importo (€)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">€</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-slate-800 border-2 border-slate-700 rounded-2xl text-xl font-black text-white outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Descrizione / Titolo</label>
                <input
                  type="text"
                  placeholder={modalType === 'income' ? 'es. Stipendio Mese, Bonus' : 'es. Spesa Supermercato, Ristorante'}
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full p-3 bg-slate-800 border-2 border-slate-700 rounded-2xl text-sm font-semibold text-white outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* Category & Date Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Categoria</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as TransactionCategory)}
                    className="w-full p-3 bg-slate-800 border-2 border-slate-700 rounded-2xl text-sm font-semibold text-white outline-none focus:border-cyan-500 transition-colors"
                  >
                    {Object.entries(CATEGORY_CONFIG)
                      .filter(([, conf]) => conf.type === modalType || conf.type === 'both')
                      .map(([k, conf]) => (
                        <option key={k} value={k}>{conf.icon} {conf.label}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full p-3 bg-slate-800 border-2 border-slate-700 rounded-2xl text-sm font-semibold text-white outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              {/* Recurring Checkbox */}
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-800/50 border border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={e => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 bg-slate-900 border-slate-700"
                />
                <span className="text-xs font-medium text-slate-200">
                  Imposta come spesa/entrata **fissa o ricorrente** (es. Affitto, Abbonamenti)
                </span>
              </label>

              {/* Note (Optional) */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Note Aggiuntive (Opzionale)</label>
                <input
                  type="text"
                  placeholder="Dettagli extra..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full p-3 bg-slate-800 border-2 border-slate-700 rounded-2xl text-sm font-medium text-slate-200 outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-3.5 rounded-2xl text-white font-bold transition-all shadow-lg active:scale-95 ${
                    modalType === 'income' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/40'
                  }`}
                >
                  Salva Transazione
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card bg-slate-900 rounded-3xl p-6 max-w-sm w-full border-2 border-slate-700 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-white">Confermi la cancellazione?</h3>
            <p className="text-xs text-slate-400">
              Questa transazione verrà rimossa permanentemente dal tuo registro locale.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-3 rounded-2xl bg-rose-600 text-white font-bold hover:bg-rose-500"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyMoney;
