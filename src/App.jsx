import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import {
  currentMonthKey, todayISO, shiftMonth, monthLabel, compareMonth,
  daysInMonth, firstWeekday, fmtMoney, activeRecurringForMonth,
  transactionsForMonth, monthTotals, cumulativeBalance,
} from './budget'

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export default function App() {
  const [tab, setTab] = useState('mois')
  const [monthKey, setMonthKey] = useState(currentMonthKey())
  const [recurringItems, setRecurringItems] = useState([])
  const [transactions, setTransactions] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [r1, r2, r3] = await Promise.all([
      supabase.from('recurring_items').select('*').order('start_month', { ascending: true }),
      supabase.from('transactions').select('*').order('date', { ascending: false }),
      supabase.from('settings').select('*').limit(1).maybeSingle(),
    ])
    if (r1.error) setError(r1.error.message)
    else setRecurringItems(r1.data)
    if (r2.error) setError(r2.error.message)
    else setTransactions(r2.data)
    if (r3.error) setError(r3.error.message)
    else setSettings(r3.data)
    setLoading(false)
  }

  return (
    <div className="app">
      {error && <div className="banner-error" onClick={() => setError(null)}>{error} — appuyer pour fermer</div>}

      <div className="tabs">
        <button className={tab === 'mois' ? 'active' : ''} onClick={() => setTab('mois')}>Mois</button>
        <button className={tab === 'avenir' ? 'active' : ''} onClick={() => setTab('avenir')}>À venir</button>
        <button className={tab === 'fixes' ? 'active' : ''} onClick={() => setTab('fixes')}>Fixes</button>
      </div>

      {loading ? (
        <div className="empty" style={{ padding: '30px 0' }}>Chargement…</div>
      ) : tab === 'mois' ? (
        <MoisTab
          monthKey={monthKey} setMonthKey={setMonthKey}
          recurringItems={recurringItems} transactions={transactions} settings={settings}
          selectedDay={selectedDay} setSelectedDay={setSelectedDay}
          reload={loadAll} setError={setError}
        />
      ) : tab === 'avenir' ? (
        <AvenirTab recurringItems={recurringItems} transactions={transactions} settings={settings} monthKey={monthKey} />
      ) : (
        <FixesTab recurringItems={recurringItems} settings={settings} reload={loadAll} setError={setError} />
      )}
    </div>
  )
}

function Hero({ recurringItems, transactions, settings, monthKey }) {
  const t = monthTotals(recurringItems, transactions, monthKey)
  const balance = cumulativeBalance(recurringItems, transactions, settings, monthKey)

  return (
    <div className="hero">
      <div className="hero-label">Solde théorique fin de mois</div>
      {balance === null ? (
        <div className="hero-figure-small">Renseigne ton solde de départ dans l'onglet Fixes</div>
      ) : (
        <div className={`hero-figure ${balance < 0 ? 'negative' : 'positive'}`}>{fmtMoney(balance)}</div>
      )}
      <div className="hero-breakdown">
        <span>Mouvements du mois <b className={t.net < 0 ? 'neg' : 'pos'}>{fmtMoney(t.net)}</b></span>
      </div>
      <div className="hero-breakdown">
        <span>Revenus <b>{fmtMoney(t.totalIncome)}</b></span>
        <span>Dépenses <b>{fmtMoney(t.totalExpense)}</b></span>
      </div>
    </div>
  )
}

function Calendar({ monthKey, recurringItems, transactions, selectedDay, setSelectedDay }) {
  const nbDays = daysInMonth(monthKey)
  const offset = firstWeekday(monthKey) - 1
  const active = activeRecurringForMonth(recurringItems, monthKey)
  const txs = transactionsForMonth(transactions, monthKey)

  function dayHasIncome(day) {
    const dateStr = monthKey + '-' + String(day).padStart(2, '0')
    const txHit = txs.some(t => t.date === dateStr && t.type === 'income')
    const recHit = active.some(r => r.type === 'income' && Math.min(r.day_of_month || 1, nbDays) === day)
    return txHit || recHit
  }
  function dayHasExpense(day) {
    const dateStr = monthKey + '-' + String(day).padStart(2, '0')
    const txHit = txs.some(t => t.date === dateStr && t.type === 'expense')
    const recHit = active.some(r => r.type === 'expense' && Math.min(r.day_of_month || 1, nbDays) === day)
    return txHit || recHit
  }

  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= nbDays; d++) cells.push(d)

  return (
    <div className="calendar">
      <div className="cal-weekdays">
        {WEEKDAYS.map((w, i) => <div key={i} className="cal-weekday">{w}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <div className="cal-cell empty-cell" key={i} />
          const dateStr = monthKey + '-' + String(d).padStart(2, '0')
          const isSelected = selectedDay === dateStr
          const isToday = dateStr === todayISO()
          return (
            <button
              key={i}
              className={`cal-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => setSelectedDay(isSelected ? null : dateStr)}
            >
              <span className="cal-day-num">{d}</span>
              <span className="cal-dots">
                {dayHasIncome(d) && <span className="dot income" />}
                {dayHasExpense(d) && <span className="dot expense" />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TransactionForm({ monthKey, selectedDay, editingTx, setEditingTx, reload, setError }) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('expense')
  const [planned, setPlanned] = useState(true)
  const [date, setDate] = useState(selectedDay || todayISO())

  useEffect(() => {
    if (editingTx) {
      setLabel(editingTx.label); setAmount(String(editingTx.amount))
      setType(editingTx.type); setPlanned(editingTx.planned); setDate(editingTx.date)
    } else {
      setDate(selectedDay || todayISO())
    }
  }, [editingTx, selectedDay])

  async function submit(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!label.trim() || isNaN(amt) || amt <= 0 || !date) return
    if (editingTx) {
      const { error } = await supabase.from('transactions')
        .update({ label: label.trim(), amount: amt, type, planned, date })
        .eq('id', editingTx.id)
      if (error) { setError(error.message); return }
      setEditingTx(null)
    } else {
      const { error } = await supabase.from('transactions')
        .insert({ label: label.trim(), amount: amt, type, planned, date })
      if (error) { setError(error.message); return }
    }
    setLabel(''); setAmount('')
    reload()
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="field-row">
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Libellé</label>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="ex. Courses, Remboursement" />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Montant</label>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Sens</label>
          <div className="toggle-group">
            <button type="button" className={type === 'income' ? 'active-income' : ''} onClick={() => setType('income')}>Revenu</button>
            <button type="button" className={type === 'expense' ? 'active-expense' : ''} onClick={() => setType('expense')}>Dépense</button>
          </div>
        </div>
        <div className="field">
          <label>Nature</label>
          <div className="toggle-group">
            <button type="button" className={planned ? 'active-planned' : ''} onClick={() => setPlanned(true)}>Prévue</button>
            <button type="button" className={!planned ? 'active-unplanned' : ''} onClick={() => setPlanned(false)}>Imprévue</button>
          </div>
        </div>
      </div>
      <button className="submit" type="submit">{editingTx ? 'Enregistrer la modification' : 'Ajouter le mouvement'}</button>
      {editingTx && <button type="button" className="submit-secondary" onClick={() => setEditingTx(null)}>Annuler</button>}
    </form>
  )
}

function MoisTab({ monthKey, setMonthKey, recurringItems, transactions, settings, selectedDay, setSelectedDay, reload, setError }) {
  const [editingTx, setEditingTx] = useState(null)
  const txs = selectedDay
    ? transactionsForMonth(transactions, monthKey).filter(t => t.date === selectedDay)
    : transactionsForMonth(transactions, monthKey)

  function changeMonth(delta) {
    setMonthKey(shiftMonth(monthKey, delta))
    setSelectedDay(null)
    setEditingTx(null)
  }

  async function removeTransaction(id) {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { setError(error.message); return }
    reload()
  }

  return (
    <>
      <div className="month-nav">
        <button onClick={() => changeMonth(-1)}>‹</button>
        <div className="month-label">{monthLabel(monthKey)}</div>
        <button onClick={() => changeMonth(1)}>›</button>
      </div>

      <Hero recurringItems={recurringItems} transactions={transactions} settings={settings} monthKey={monthKey} />

      <div className="section">
        <Calendar monthKey={monthKey} recurringItems={recurringItems} transactions={transactions}
          selectedDay={selectedDay} setSelectedDay={setSelectedDay} />
      </div>

      <div className="section">
        <div className="section-title" style={{ marginBottom: 10 }}>
          {editingTx ? 'Modifier le mouvement' : 'Nouveau mouvement'}
        </div>
        <TransactionForm monthKey={monthKey} selectedDay={selectedDay} editingTx={editingTx}
          setEditingTx={setEditingTx} reload={reload} setError={setError} />
      </div>

      <div className="section">
        <div className="section-head">
          <div className="section-title">
            {selectedDay ? `Mouvements du ${selectedDay.split('-').reverse().join('/')}` : 'Mouvements du mois'}
          </div>
          {selectedDay && <button className="section-link" onClick={() => setSelectedDay(null)}>voir tout le mois</button>}
        </div>
        {txs.length === 0 && <div className="empty">Rien de saisi ici.</div>}
        {txs.map(tx => (
          <div className="row" key={tx.id}>
            <div className="row-main" onClick={() => setEditingTx(tx)} style={{ cursor: 'pointer' }}>
              <div className="row-label">{tx.label}</div>
              <div className="row-tag">{tx.date.split('-').reverse().join('/')} · {tx.planned ? 'prévue' : 'imprévue'}</div>
            </div>
            <div className={`row-amount ${tx.type}`}>{tx.type === 'income' ? '+' : '-'}{fmtMoney(Number(tx.amount))}</div>
            <button className="row-del" onClick={() => removeTransaction(tx.id)}>✕</button>
          </div>
        ))}
      </div>
    </>
  )
}

function AvenirTab({ recurringItems, transactions, settings, monthKey }) {
  if (!settings) {
    return <div className="empty" style={{ padding: '30px 0' }}>Renseigne d'abord ton solde de départ dans l'onglet Fixes.</div>
  }
  const start = compareMonth(monthKey, settings.starting_balance_month) >= 0 ? monthKey : settings.starting_balance_month
  const months = []
  let cursor = start
  for (let i = 0; i < 6; i++) {
    months.push(cursor)
    cursor = shiftMonth(cursor, 1)
  }

  return (
    <div className="section">
      <div className="section-title" style={{ marginBottom: 10 }}>Projection des 6 prochains mois</div>
      {months.map(m => {
        const t = monthTotals(recurringItems, transactions, m)
        const balance = cumulativeBalance(recurringItems, transactions, settings, m)
        return (
          <div className="row avenir-row" key={m}>
            <div className="row-main">
              <div className="row-label" style={{ textTransform: 'capitalize' }}>{monthLabel(m)}</div>
              <div className="row-tag">Revenus {fmtMoney(t.totalIncome)} · Dépenses {fmtMoney(t.totalExpense)}</div>
            </div>
            <div className={`row-amount ${balance < 0 ? 'expense' : 'income'}`} style={{ fontSize: 16 }}>
              {fmtMoney(balance)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RecurringForm({ reload, setError }) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('expense')
  const [startMonth, setStartMonth] = useState(currentMonthKey())
  const [dayOfMonth, setDayOfMonth] = useState('1')

  async function submit(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    const dom = parseInt(dayOfMonth) || 1
    if (!label.trim() || isNaN(amt) || amt <= 0) return
    const { error } = await supabase.from('recurring_items').insert({
      label: label.trim(), amount: amt, type, start_month: startMonth, day_of_month: dom,
    })
    if (error) { setError(error.message); return }
    setLabel(''); setAmount('')
    reload()
  }

  return (
    <form className="card" onSubmit={submit} style={{ marginBottom: 14 }}>
      <div className="field">
        <label>Libellé</label>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="ex. Loyer, Salaire, Spotify" />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Montant</label>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
        </div>
        <div className="field">
          <label>Jour du mois</label>
          <input type="number" min="1" max="31" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Sens</label>
          <div className="toggle-group">
            <button type="button" className={type === 'income' ? 'active-income' : ''} onClick={() => setType('income')}>Revenu</button>
            <button type="button" className={type === 'expense' ? 'active-expense' : ''} onClick={() => setType('expense')}>Dépense</button>
          </div>
        </div>
        <div className="field">
          <label>À partir de</label>
          <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)} />
        </div>
      </div>
      <button className="submit" type="submit">Ajouter la ligne fixe</button>
    </form>
  )
}

function RecurringEditRow({ item, reload, setError }) {
  const [editing, setEditing] = useState(false)
  const [newAmount, setNewAmount] = useState(String(item.amount))
  const [effectiveMonth, setEffectiveMonth] = useState(shiftMonth(currentMonthKey(), 1))

  async function applyChange(e) {
    e.preventDefault()
    const amt = parseFloat(newAmount)
    if (isNaN(amt) || amt <= 0) return
    if (compareMonth(effectiveMonth, item.start_month) <= 0) {
      setError("La date d'effet doit être après le début actuel de ce poste.")
      return
    }
    const prevMonth = shiftMonth(effectiveMonth, -1)
    const { error: e1 } = await supabase.from('recurring_items')
      .update({ end_month: prevMonth }).eq('id', item.id)
    if (e1) { setError(e1.message); return }
    const { error: e2 } = await supabase.from('recurring_items').insert({
      group_id: item.group_id, label: item.label, amount: amt, type: item.type,
      start_month: effectiveMonth, end_month: null, day_of_month: item.day_of_month,
    })
    if (e2) { setError(e2.message); return }
    setEditing(false)
    reload()
  }

  async function removeGroup() {
    const { error } = await supabase.from('recurring_items').delete().eq('group_id', item.group_id)
    if (error) { setError(error.message); return }
    reload()
  }

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="row" style={{ borderBottom: 'none', padding: '0 0 6px' }}>
        <div className="row-main">
          <div className="row-label">{item.label}</div>
          <div className="row-tag">depuis {item.start_month}{item.end_month ? ` → jusqu'à ${item.end_month}` : ''}</div>
        </div>
        <div className={`row-amount ${item.type}`}>{item.type === 'income' ? '+' : '-'}{fmtMoney(Number(item.amount))}</div>
      </div>
      {!editing ? (
        <div className="row-actions">
          <button className="section-link" onClick={() => setEditing(true)}>modifier le montant</button>
          <button className="section-link danger" onClick={removeGroup}>supprimer</button>
        </div>
      ) : (
        <form onSubmit={applyChange} className="field-row" style={{ marginTop: 8 }}>
          <div className="field">
            <label>Nouveau montant</label>
            <input type="number" step="0.01" value={newAmount} onChange={e => setNewAmount(e.target.value)} />
          </div>
          <div className="field">
            <label>À partir de</label>
            <input type="month" value={effectiveMonth} onChange={e => setEffectiveMonth(e.target.value)} />
          </div>
          <button className="submit" type="submit" style={{ marginTop: 20 }}>OK</button>
        </form>
      )}
    </div>
  )
}

function SettingsCard({ settings, reload, setError }) {
  const [amount, setAmount] = useState(settings ? String(settings.starting_balance) : '0')
  const [month, setMonth] = useState(settings ? settings.starting_balance_month : currentMonthKey())

  async function save(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (isNaN(amt)) return
    const { error } = await supabase.from('settings')
      .update({ starting_balance: amt, starting_balance_month: month })
      .eq('id', true)
    if (error) { setError(error.message); return }
    reload()
  }

  return (
    <form className="card" onSubmit={save} style={{ marginBottom: 20 }}>
      <div className="section-title" style={{ marginBottom: 10 }}>Solde de départ</div>
      <div className="field-row">
        <div className="field">
          <label>Montant en poche</label>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label>Au début de</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
        </div>
      </div>
      <button className="submit" type="submit">Enregistrer</button>
    </form>
  )
}

function FixesTab({ recurringItems, settings, reload, setError }) {
  const [showForm, setShowForm] = useState(false)
  // On n'affiche qu'un segment "courant" par groupe pour la liste (le plus récent démarré)
  const latestByGroup = {}
  for (const item of recurringItems) {
    const g = latestByGroup[item.group_id]
    if (!g || compareMonth(item.start_month, g.start_month) > 0) latestByGroup[item.group_id] = item
  }
  const items = Object.values(latestByGroup)

  return (
    <div className="section">
      <SettingsCard settings={settings} reload={reload} setError={setError} />

      <div className="section-head">
        <div className="section-title">Postes fixes / récurrents</div>
        <button className="section-link" onClick={() => setShowForm(s => !s)}>{showForm ? 'fermer' : '+ ajouter'}</button>
      </div>
      {showForm && <RecurringForm reload={reload} setError={setError} />}
      {items.length === 0 && <div className="empty">Aucun poste fixe pour l'instant.</div>}
      {items.map(item => <RecurringEditRow key={item.group_id} item={item} reload={reload} setError={setError} />)}
    </div>
  )
}
