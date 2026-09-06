export const MONTH_NAMES = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"]

export function currentMonthKey() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}

export function todayISO() {
  return isoDate(new Date())
}

function isoDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
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

export function compareMonth(a, b) {
  return a.localeCompare(b)
}

export function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function firstWeekday(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1, 1).getDay()
  return d === 0 ? 7 : d
}

export function fmtMoney(n) {
  const sign = n < 0 ? '-' : ''
  return sign + Math.abs(n).toFixed(2).replace('.', ',') + ' €'
}

export function fmtDate(dateStr) {
  return dateStr.split('-').reverse().join('/')
}

// Segments de postes récurrents actifs pour un mois donné (start_month <= mois <= end_month)
export function activeRecurringForMonth(recurringItems, monthKey) {
  return recurringItems.filter(r =>
    compareMonth(r.start_month, monthKey) <= 0 &&
    (!r.end_month || compareMonth(r.end_month, monthKey) >= 0)
  )
}

// Dates d'occurrence d'un segment récurrent dans un mois donné
export function occurrencesInMonth(item, monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0)
  const dates = []

  if (item.recurrence_type === 'interval' && item.interval_days && item.anchor_date) {
    const msPerDay = 86400000
    let d = new Date(item.anchor_date + 'T00:00:00')
    const diffDays = Math.floor((start - d) / msPerDay)
    if (diffDays > 0) {
      const steps = Math.floor(diffDays / item.interval_days)
      d = new Date(d.getTime() + steps * item.interval_days * msPerDay)
    }
    while (d <= end) {
      if (d >= start) dates.push(isoDate(d))
      d = new Date(d.getTime() + item.interval_days * msPerDay)
    }
  } else {
    const dom = Math.min(item.day_of_month || 1, end.getDate())
    dates.push(monthKey + '-' + String(dom).padStart(2, '0'))
  }
  return dates
}

// Étend les postes récurrents actifs en occurrences concrètes pour un mois, en appliquant les exceptions
export function expandMonthOccurrences(recurringItems, exceptions, monthKey) {
  const active = activeRecurringForMonth(recurringItems, monthKey)
  const results = []
  for (const item of active) {
    const dates = occurrencesInMonth(item, monthKey)
    for (const date of dates) {
      const ex = exceptions.find(e => e.group_id === item.group_id && e.occurrence_date === date)
      if (ex && ex.skip) continue
      results.push({
        id: `rec-${item.group_id}-${date}`,
        group_id: item.group_id,
        occurrence_date: date,
        date: (ex && ex.override_date) || date,
        label: (ex && ex.override_label) || item.label,
        amount: (ex && ex.override_amount != null) ? Number(ex.override_amount) : Number(item.amount),
        type: item.type,
        kind: 'recurring',
        hasOverride: !!ex,
      })
    }
  }
  return results
}

export function transactionsForMonth(transactions, monthKey) {
  return transactions.filter(t => monthKeyFromDate(t.date) === monthKey)
}

export function monthTotals(recurringItems, transactions, exceptions, monthKey) {
  const recs = expandMonthOccurrences(recurringItems, exceptions, monthKey)
  const fixedIncome = recs.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)
  const fixedExpense = recs.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  const txs = transactionsForMonth(transactions, monthKey)
  const txIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const txExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const totalIncome = fixedIncome + txIncome
  const totalExpense = fixedExpense + txExpense
  return {
    fixedIncome, fixedExpense, txIncome, txExpense, totalIncome, totalExpense,
    net: totalIncome - totalExpense,
  }
}

export function cumulativeBalance(recurringItems, transactions, exceptions, settings, monthKey) {
  if (!settings) return null
  if (compareMonth(monthKey, settings.starting_balance_month) < 0) return null
  let balance = Number(settings.starting_balance)
  let cursor = settings.starting_balance_month
  while (true) {
    const t = monthTotals(recurringItems, transactions, exceptions, cursor)
    balance += t.net
    if (cursor === monthKey) break
    cursor = shiftMonth(cursor, 1)
  }
  return balance
}
