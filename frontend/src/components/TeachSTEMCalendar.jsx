import { useState } from 'react'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Dates come from the API as 'YYYY-MM-DD'; build them in local time so they don't shift a day.
export function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toKey(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

export function todayKey() {
  return toKey(new Date())
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function formatEventWhen(event) {
  const opts = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
  let when = parseDate(event.date).toLocaleDateString('en-US', opts)
  if (event.end_date) when += ` – ${parseDate(event.end_date).toLocaleDateString('en-US', opts)}`
  if (event.start_time) {
    when += `, ${formatTime(event.start_time)}`
    if (event.end_time) when += ` – ${formatTime(event.end_time)}`
  }
  return when
}

function eventsOnDay(events, key) {
  return events.filter(e => e.date <= key && (e.end_date || e.date) >= key)
}

export function EventDetails({ event }) {
  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: '0.97rem' }}>{event.title}</div>
      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--teal-dark)', marginBottom: '0.2rem' }}>
        {formatEventWhen(event)}
      </div>
      {event.location && <div className="text-muted text-sm">{event.location}</div>}
      {event.description && (
        <p className="text-muted text-sm" style={{ marginBottom: 0, marginTop: '0.25rem', whiteSpace: 'pre-line' }}>{event.description}</p>
      )}
      {event.link && (
        <a href={event.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
          Event link
        </a>
      )}
    </div>
  )
}

export function MonthCalendar({ events }) {
  const now = new Date()
  const [month, setMonth]       = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [selected, setSelected] = useState(null)   // 'YYYY-MM-DD'

  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [
    ...Array(first.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ]
  const today = todayKey()
  const shift = (n) => { setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1)); setSelected(null) }
  const selectedEvents = selected ? eventsOnDay(events, selected) : []

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.5rem' }}>
        <button onClick={() => shift(-1)} className="btn btn--outline btn--sm" aria-label="Previous month">Prev</button>
        <div style={{ fontWeight: 900, color: 'var(--teal-dark)' }}>
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <button onClick={() => shift(1)} className="btn btn--outline btn--sm" aria-label="Next month">Next</button>
      </div>

      <div className="cal-grid">
        {WEEKDAYS.map(d => <div key={d} className="cal-weekday">{d}</div>)}
        {cells.map((date, i) => {
          if (!date) return <div key={`blank-${i}`} />
          const key = toKey(date)
          const dayEvents = eventsOnDay(events, key)
          const classes = ['cal-day']
          if (key === today) classes.push('cal-day--today')
          if (key === selected) classes.push('cal-day--selected')
          return (
            <button
              key={key}
              className={classes.join(' ')}
              onClick={() => setSelected(key === selected ? null : key)}
              aria-label={`${date.toDateString()}, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`}
            >
              <span className="cal-day-num">{date.getDate()}</span>
              {dayEvents.slice(0, 2).map(e => <span key={e.id} className="cal-chip">{e.title}</span>)}
              {dayEvents.length > 2 && <span className="cal-more">+{dayEvents.length - 2} more</span>}
              {dayEvents.length > 0 && <span className="cal-dot" />}
            </button>
          )
        })}
      </div>

      {selected && (
        <div style={{ marginTop: '0.9rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            {parseDate(selected).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          {selectedEvents.length === 0
            ? <p className="text-muted text-sm" style={{ fontStyle: 'italic', marginBottom: 0 }}>No events this day.</p>
            : selectedEvents.map(e => <div key={e.id} style={{ marginBottom: '0.6rem' }}><EventDetails event={e} /></div>)}
        </div>
      )}
    </div>
  )
}

export function GoogleCalendarEmbed({ url }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <iframe
        src={url}
        title="Teach STEM Google Calendar"
        style={{ border: 0, width: '100%', height: 600, display: 'block' }}
      />
    </div>
  )
}
