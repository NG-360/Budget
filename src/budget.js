export const MONTH_NAMES = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"]

export function currentMonthKey() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function monthKeyFromDate(dateStr) {
  return dateStr.slice(0, 7)
}

export function shiftMonth(key, delta) {
  let [y, m] = key.split('-').map(Number)
  m += delta
  while (m < 1) { m += 12; y -= 1 }
  while (m > 12) { m -= 12; y += 1 }
  return y + '-' + String(m).padStart(2, '0')
}

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return MONTH_NAMES[m - 1] + ' ' + y
}

// Compare deux 'YYYY-MM' : négatif si a < b, 0 si égal, positif si a > b
export function compareMonth(a, b) {
  return a.localeCompare(b)
}

export function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// Jour de la semaine (1=lundi ... 7=dimanche) du 1er du mois
export function firstWeekday(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1, 1).getDay() // 0=dimanche
  return d === 0 ? 7 : d
}

export function fmtMoney(n) {
  const sign = n < 0 ? '-' : ''
  return sign + Math.abs(n).toFixed(2).replace('.', ',') + ' €'
}

// Postes récurrents actifs pour un mois donné
export function activeRecurringForMonth(recurringItems, monthKey) {
  return recurringItems.filter(r =>
    compareMonth(r.start_month, monthKey) <= 0 &&
    (!r.end_month || compareMonth(r.end_month, monthKey) >= 0)
  )
}

export function recurringTotals(recurringItems, monthKey) {
  const active = activeRecurringForMonth(recurringItems, monthKey)
  const income = active.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0)
  const expense = active.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0)
  return { income, expense, active }
}

export function transactionsForMonth(transactions, monthKey) {
  return transactions.filter(t => monthKeyFromDate(t.date) === monthKey)
}

export function monthTotals(recurringItems, transactions, monthKey) {
  const fixed = recurringTotals(recurringItems, monthKey)
  const txs = transactionsForMonth(transactions, monthKey)
  const txIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const txExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const totalIncome = fixed.income + txIncome
  const totalExpense = fixed.expense + txExpense
  return {
    fixedIncome: fixed.income, fixedExpense: fixed.expense,
    txIncome, txExpense, totalIncome, totalExpense,
    net: totalIncome - totalExpense,
  }
}

// Solde cumulé théorique à la fin de monthKey, en partant de settings.starting_balance
// posé au début de settings.starting_balance_month.
export function cumulativeBalance(recurringItems, transactions, settings, monthKey) {
  if (!settings) return null
  if (compareMonth(monthKey, settings.starting_balance_month) < 0) return null
  let balance = Number(settings.starting_balance)
  let cursor = settings.starting_balance_month
  while (true) {
    const t = monthTotals(recurringItems, transactions, cursor)
    balance += t.net
    if (cursor === monthKey) break
    cursor = shiftMonth(cursor, 1)
  }
  return balance
}
