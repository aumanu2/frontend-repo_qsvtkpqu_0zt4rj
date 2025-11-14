import { useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function formatDate(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function DayCell({ date, checked, onToggle }) {
  return (
    <button
      onClick={() => onToggle(date)}
      className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-medium transition-colors border ${
        checked ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
      }`}
      title={date.toDateString()}
    >
      {date.getDate()}
    </button>
  )
}

function HabitRow({ habit, month, logs, onToggle, onDelete }) {
  const days = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    const list = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      list.push(new Date(d))
    }
    return list
  }, [month])

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ background: habit.color }} />
          <div>
            <p className="font-semibold text-gray-800">{habit.name}</p>
            {habit.description && (
              <p className="text-xs text-gray-500">{habit.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(habit.id)}
          className="text-red-600 text-sm hover:underline"
        >
          Delete
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const key = formatDate(d)
          const checked = !!logs[key]
          return (
            <DayCell
              key={key}
              date={d}
              checked={checked}
              onToggle={(date) => onToggle(habit.id, date)}
            />
          )
        })}
      </div>
    </div>
  )
}

function NewHabitForm({ onCreate }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#6366f1')

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    await onCreate({ name, description: description || null, color })
    setName('')
    setDescription('')
    setColor('#6366f1')
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New habit name"
        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="flex-[2] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
      />
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="w-12 h-10 rounded-lg border border-gray-200"
        title="Pick a color"
      />
      <button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 font-semibold">Add</button>
    </form>
  )
}

function App() {
  const [month, setMonth] = useState(new Date())
  const [habits, setHabits] = useState([])
  const [logsByHabit, setLogsByHabit] = useState({}) // { habitId: { 'YYYY-MM-DD': true } }
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/habits`)
      const habitsData = await res.json()
      setHabits(habitsData)

      // Load logs for current month for each habit
      const start = formatDate(startOfMonth(month))
      const end = formatDate(endOfMonth(month))
      const entries = {}
      await Promise.all(
        habitsData.map(async (h) => {
          const r = await fetch(`${API_BASE}/api/habits/${h.id}/logs?start=${start}&end=${end}`)
          const list = await r.json()
          entries[h.id] = list.reduce((acc, l) => {
            acc[l.day] = true
            return acc
          }, {})
        })
      )
      setLogsByHabit(entries)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const createHabit = async (payload) => {
    const res = await fetch(`${API_BASE}/api/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const created = await res.json()
    setHabits((h) => [created, ...h])
    // initialize empty logs state for this habit
    setLogsByHabit((prev) => ({ ...prev, [created.id]: {} }))
  }

  const deleteHabit = async (id) => {
    await fetch(`${API_BASE}/api/habits/${id}`, { method: 'DELETE' })
    setHabits((h) => h.filter((x) => x.id !== id))
    setLogsByHabit((prev) => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  const toggle = async (habitId, date) => {
    const day = formatDate(date)
    await fetch(`${API_BASE}/api/habits/${habitId}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, value: 1 }),
    })
    setLogsByHabit((prev) => {
      const copy = { ...prev }
      const habitLogs = { ...(copy[habitId] || {}) }
      if (habitLogs[day]) delete habitLogs[day]
      else habitLogs[day] = true
      copy[habitId] = habitLogs
      return copy
    })
  }

  const changeMonth = (delta) => {
    const d = new Date(month)
    d.setMonth(d.getMonth() + delta)
    setMonth(d)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Habit Tracker</h1>
            <p className="text-gray-500">Create habits and tick off days to build streaks.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="px-3 py-2 rounded-lg border bg-white">Prev</button>
            <span className="px-3 py-2 text-gray-700 font-semibold">
              {month.toLocaleString('default', { month: 'long' })} {month.getFullYear()}
            </span>
            <button onClick={() => changeMonth(1)} className="px-3 py-2 rounded-lg border bg-white">Next</button>
          </div>
        </header>

        <NewHabitForm onCreate={createHabit} />

        {loading ? (
          <div className="text-center text-gray-500">Loading...</div>
        ) : habits.length === 0 ? (
          <div className="text-center text-gray-500">No habits yet. Add your first one above.</div>
        ) : (
          <div className="grid gap-4">
            {habits.map((h) => (
              <HabitRow
                key={h.id}
                habit={h}
                month={month}
                logs={logsByHabit[h.id] || {}}
                onToggle={toggle}
                onDelete={deleteHabit}
              />)
            )}
          </div>
        )}

        <div className="pt-4">
          <a href="/test" className="text-sm text-gray-500 hover:underline">Backend & DB status</a>
        </div>
      </div>
    </div>
  )
}

export default App
