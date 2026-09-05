import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const MONTH_NAMES = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"]

function currentMonthKey() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}

function shiftMonth(key, delta) {
  let [y, m] = key.split('-').map(Number)
  m += delta
  if (m < 1) { m = 12; y -= 1 }
  if (m > 12) { m = 1; y += 1 }
  return y + '-' + String(m).padStart(2, '0')
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return MONTH_NAMES[m - 1] + ' ' + y
}

function fmtMoney(n) {
  const sign = n < 0 ? '-' : ''
  return sign + Math.abs(n).toFixed(2).replace('.', ',') + ' €'
}

export default function App() {
  const [monthKey, setMonthKey] = useState(currentMonthKey())
  const [fixedItems, setFixedItems] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showFixedForm, setShowFixedForm] = useState(false)
  const [fixedLabel, setFixedLabel] = useState('')
  const [fixedAmount, setFixedAmount] = useState('')
  const [fixedType, setFixedType] = useState('expense')

  const [txLabel, setTxLabel] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [txType, setTxType] = useState('expense')
  const [txPlanned, setTxPlanned] = useState(true)

  useEffect(() => { loadFixedItems() }, [])
  useEffect(() => { loadTransactions(monthKey) }, [monthKey])

  async function loadFixedItems() {
    const { data, error } = await supabase
      .from('fixed_items')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) setError(error.message)
    else setFixedItems(data)
  }

  async function loadTransactions(key) {
    setLoading(true)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('month_key', key)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setTransactions(data)
    setLoading(false)
  }

  async function addFixedItem(e) {
    e.preventDefault()
    const amount = parseFloat(fixedAmount)
    if (!fixedLabel.trim() || isNaN(amount) || amount <= 0) return
    const { error } = await supabase
      .from('fixed_items')
      .insert({ label: fixedLabel.trim(), amount, type: fixedType })
    if (error) { setError(error.message); return }
    setFixedLabel(''); setFixedAmount(''); setShowFixedForm(false)
    loadFixedItems()
  }

  async function removeFixedItem(id) {
    const { error } = await supabase.from('fixed_items').delete().eq('id', id)
    if (error) { setError(error.message); return }
    loadFixedItems()
  }

  async function addTransaction(e) {
    e.preventDefault()
    const amount = parseFloat(txAmount)
    if (!txLabel.trim() || isNaN(amount) || amount <= 0) return
    const { error } = await supabase.from('transactions').insert({
      month_key: monthKey,
      label: txLabel.trim(),
      amount,
      type: txType,
      planned: txPlanned,
    })
    if (error) { setError(error.message); return }
    setTxLabel(''); setTxAmount('')
    loadTransactions(monthKey)
  }

  async function removeTransaction(id) {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { setError(error.message); return }
    loadTransactions(monthKey)
  }

  const totals = useMemo(() => {
    const fixedIncome = fixedItems.filter(i => i.type === 'income').reduce((s, i) => s + Number(i.amount), 0)
    const fixedExpense = fixedItems.filter(i => i.type === 'expense').reduce((s, i) => s + Number(i.amount), 0)
    const txIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const txExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const totalIncome = fixedIncome + txIncome
    const totalExpense = fixedExpense + txExpense
    return { fixedIncome, fixedExpense, txIncome, txExpense, totalIncome, totalExpense, restant: totalIncome - totalExpense }
  }, [fixedItems, transactions])

  return (
    <div className="app">
      {error && (
        <div className="banner-error" onClick={() => setError(null)}>
          {error} — appuyer pour fermer
        </div>
      )}

      <div className="month-nav">
        <button onClick={() => setMonthKey(shiftMonth(monthKey, -1))}>‹</button>
        <div className="month-label">{monthLabel(monthKey)}</div>
        <button onClick={() => setMonthKey(shiftMonth(monthKey, 1))}>›</button>
      </div>

      <div className="hero">
        <div className="hero-label">Restant ce mois</div>
        <div className={`hero-figure ${totals.restant < 0 ? 'negative' : 'positive'}`}>
          {fmtMoney(totals.restant)}
        </div>
        <div className="hero-breakdown">
          <span>Revenus <b>{fmtMoney(totals.totalIncome)}</b></span>
          <span>Dépenses <b>{fmtMoney(totals.totalExpense)}</b></span>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <div className="section-title">Fixes provisionnés</div>
          <button className="section-link" onClick={() => setShowFixedForm(s => !s)}>
            {showFixedForm ? 'fermer' : '+ ajouter'}
          </button>
        </div>

        {showFixedForm && (
          <form className="card" onSubmit={addFixedItem} style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Libellé</label>
              <input value={fixedLabel} onChange={e => setFixedLabel(e.target.value)} placeholder="ex. Loyer, Salaire, Spotify" />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Montant</label>
                <input type="number" step="0.01" value={fixedAmount} onChange={e => setFixedAmount(e.target.value)} placeholder="0,00" />
              </div>
              <div className="field">
                <label>Sens</label>
                <div className="toggle-group">
                  <button type="button" className={fixedType === 'income' ? 'active-income' : ''} onClick={() => setFixedType('income')}>Revenu</button>
                  <button type="button" className={fixedType === 'expense' ? 'active-expense' : ''} onClick={() => setFixedType('expense')}>Dépense</button>
                </div>
              </div>
            </div>
            <button className="submit" type="submit">Ajouter la ligne fixe</button>
          </form>
        )}

        {fixedItems.length === 0 && <div className="empty">Aucune ligne fixe pour l'instant.</div>}
        {fixedItems.map(i => (
          <div className="row" key={i.id}>
            <div className="row-main"><div className="row-label">{i.label}</div></div>
            <div className={`row-amount ${i.type}`}>{i.type === 'income' ? '+' : '-'}{fmtMoney(Number(i.amount))}</div>
            <button className="row-del" onClick={() => removeFixedItem(i.id)}>✕</button>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-title" style={{ marginBottom: 10 }}>Nouveau mouvement</div>
        <form className="card" onSubmit={addTransaction}>
          <div className="field">
            <label>Libellé</label>
            <input value={txLabel} onChange={e => setTxLabel(e.target.value)} placeholder="ex. Courses, Remboursement" />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Montant</label>
              <input type="number" step="0.01" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0,00" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Sens</label>
              <div className="toggle-group">
                <button type="button" className={txType === 'income' ? 'active-income' : ''} onClick={() => setTxType('income')}>Revenu</button>
                <button type="button" className={txType === 'expense' ? 'active-expense' : ''} onClick={() => setTxType('expense')}>Dépense</button>
              </div>
            </div>
            <div className="field">
              <label>Nature</label>
              <div className="toggle-group">
                <button type="button" className={txPlanned ? 'active-planned' : ''} onClick={() => setTxPlanned(true)}>Prévue</button>
                <button type="button" className={!txPlanned ? 'active-unplanned' : ''} onClick={() => setTxPlanned(false)}>Imprévue</button>
              </div>
            </div>
          </div>
          <button className="submit" type="submit">Ajouter le mouvement</button>
        </form>
      </div>

      <div className="section">
        <div className="section-title" style={{ marginBottom: 10 }}>Mouvements du mois</div>
        {loading && <div className="empty">Chargement…</div>}
        {!loading && transactions.length === 0 && <div className="empty">Rien de saisi ce mois-ci.</div>}
        {transactions.map(tx => (
          <div className="row" key={tx.id}>
            <div className="row-main">
              <div className="row-label">{tx.label}</div>
              <div className="row-tag">{tx.planned ? 'prévue' : 'imprévue'}</div>
            </div>
            <div className={`row-amount ${tx.type}`}>{tx.type === 'income' ? '+' : '-'}{fmtMoney(Number(tx.amount))}</div>
            <button className="row-del" onClick={() => removeTransaction(tx.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
