import { useEffect, useMemo, useState } from 'react'
import { supabase, supabaseError } from './supabaseClient.js'
import 'katex/dist/katex.min.css'
import { BlockMath, InlineMath } from 'react-katex'

const itemTypes = [
  { value: 'All', label: 'All entries' },
  { value: 'formula', label: 'Formula' },
  { value: 'note', label: 'Note' },
  { value: 'reel', label: 'Reel' },
]

function App() {
  const [items, setItems] = useState([])
  const [activeType, setActiveType] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [newType, setNewType] = useState('formula')
  const [newContent, setNewContent] = useState('')
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [reelSeed, setReelSeed] = useState(Date.now())

  useEffect(() => {
    loadItems()
  }, [])

  async function loadItems() {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('items')
      .select('*')
      .order('id', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setItems(data ?? [])
    }
    setLoading(false)
  }

  async function addItem() {
    if (!newContent.trim()) return
    setLoading(true)
    setError(null)
    const { error: insertError } = await supabase.from('items').insert([
      { type: newType, content: newContent.trim() },
    ])
    if (insertError) {
      setError(insertError.message)
    } else {
      setNewContent('')
      loadItems()
    }
    setLoading(false)
  }

  async function startEdit(item) {
    setEditingId(item.id)
    setEditContent(item.content)
  }

  async function saveEdit() {
    if (!editContent.trim()) return
    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('items')
      .update({ content: editContent.trim() })
      .eq('id', editingId)
    if (updateError) {
      setError(updateError.message)
    } else {
      setEditingId(null)
      setEditContent('')
      loadItems()
    }
    setLoading(false)
  }

  async function deleteItem(itemId) {
    setLoading(true)
    setError(null)
    const { error: deleteError } = await supabase.from('items').delete().eq('id', itemId)
    if (deleteError) {
      setError(deleteError.message)
    } else {
      loadItems()
    }
    setLoading(false)
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesType = activeType === 'All' || item.type === activeType
      const query = searchTerm.trim().toLowerCase()
      const matchesSearch =
        !query ||
        item.content.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query)
      return matchesType && matchesSearch
    })
  }, [activeType, items, searchTerm])

  const reelItems = useMemo(() => {
    const pool = items.filter((item) => item.type === 'formula' || item.type === 'note')
    return [...pool].sort(() => Math.random() - 0.5)
  }, [items, reelSeed])

  const [reelIndex, setReelIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const lastNavRef = { last: 0 }

  function clampIndex(i) {
    if (!reelItems || reelItems.length === 0) return 0
    if (i < 0) return 0
    if (i >= reelItems.length) return reelItems.length - 1
    return i
  }

  function goToIndex(i) {
    const now = Date.now()
    if (now - lastNavRef.last < 350) return // simple throttle
    lastNavRef.last = now
    setIsTransitioning(true)
    setReelIndex(clampIndex(i))
    setTimeout(() => setIsTransitioning(false), 360)
  }

  function nextReel() {
    goToIndex(reelIndex + 1)
  }

  function prevReel() {
    goToIndex(reelIndex - 1)
  }

  // wheel and keyboard handlers for TikTok-like navigation
  useEffect(() => {
    let touchStartY = null
    function onWheel(e) {
      if (activeType !== 'reel') return
      if (e.deltaY > 10) nextReel()
      else if (e.deltaY < -10) prevReel()
    }
    function onKey(e) {
      if (activeType !== 'reel') return
      if (e.key === 'ArrowDown' || e.key === 'PageDown') nextReel()
      if (e.key === 'ArrowUp' || e.key === 'PageUp') prevReel()
    }
    function onTouchStart(e) {
      if (activeType !== 'reel') return
      touchStartY = e.touches?.[0]?.clientY ?? null
    }
    function onTouchEnd(e) {
      if (activeType !== 'reel' || touchStartY == null) return
      const endY = e.changedTouches?.[0]?.clientY ?? null
      if (endY == null) return
      const d = touchStartY - endY
      if (d > 40) nextReel()
      else if (d < -40) prevReel()
      touchStartY = null
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [activeType, reelIndex, reelItems])

  function renderContentText(text) {
    if (!text) return null
    // split into lines and render math blocks if the line looks like an equation
    const lines = text.split('\n')
    return lines.map((line, idx) => {
      const trimmed = line.trim()
      // explicit LaTeX block delimiter $$...$$
      const blockMatch = trimmed.match(/\$\$(.*)\$\$/)
      if (blockMatch) return <BlockMath key={idx}>{blockMatch[1]}</BlockMath>

      // inline $...$ segments
      if (trimmed.includes('$')) {
        const parts = trimmed.split(/(\$[^$]+\$)/g)
        return (
          <div key={idx} style={{ marginBottom: '8px' }}>
            {parts.map((p, i) => {
              if (p.startsWith('$') && p.endsWith('$')) return <InlineMath key={i}>{p.slice(1, -1)}</InlineMath>
              return <span key={i}>{p}</span>
            })}
          </div>
        )
      }

      // heuristic: if line contains an equals sign or common math words, render as BlockMath
      const mathHints = ['=', 'sqrt', '^', 'frac', 'pi', 'Σ', 'SUM', 'Δ', '→', 'approx', '≈']
      const looksLikeMath = mathHints.some((h) => trimmed.includes(h))
      if (looksLikeMath) {
        // try to render raw text as LaTeX; if it fails, fall back to plain text
        try {
          return (
            <div key={idx} style={{ marginBottom: '8px' }}>
              <BlockMath>{trimmed}</BlockMath>
            </div>
          )
        } catch (e) {
          return (
            <div key={idx} style={{ marginBottom: '8px' }}>
              {trimmed}
            </div>
          )
        }
      }

      return (
        <div key={idx} style={{ marginBottom: '6px', whiteSpace: 'pre-wrap' }}>
          {trimmed}
        </div>
      )
    })
  }

  const counts = useMemo(() => {
    const countsMap = { All: items.length, formula: 0, note: 0, reel: 0 }
    items.forEach((item) => {
      if (item.type in countsMap) countsMap[item.type] += 1
    })
    return countsMap
  }, [items])

  const sectionHeading = activeType === 'All' ? 'All entries' : `${itemTypes.find((t) => t.value === activeType)?.label}s`
  const sectionSub = searchTerm
    ? `${filteredItems.length} entries matching “${searchTerm}”`
    : `${filteredItems.length} ${filteredItems.length === 1 ? 'entry' : 'entries'}`

  if (supabaseError) {
    return (
      <div className="app">
        <main>
          <div className="empty">{supabaseError}</div>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <h1>Field Reference</h1>
          <div className="sub">CFA® Level II</div>
        </div>

        <ul className="navlist">
          {itemTypes.map((type) => (
            <li key={type.value}>
              <button
                className={activeType === type.value ? 'active' : ''}
                onClick={() => setActiveType(type.value)}
              >
                <span>{type.label}</span>
                <span className="count">{type.value === 'All' ? counts.All : counts[type.value] || 0}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="sidebar-footer">
          <button onClick={() => setSearchTerm('')}>Clear search</button>
          <div className="sync-status">
            <span className="sync-dot on" />
            <span>Live Supabase data</span>
          </div>
        </div>
      </nav>

      <main>
        <div className="topbar">
          <div className="search">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search formulas, notes, reel items…"
            />
          </div>
          <button className="add-btn" onClick={addItem} disabled={loading || !newContent.trim()}>
            + Add item
          </button>
        </div>

        {activeType === 'reel' ? (
          <>
            <div className="section-title">Reel scroll</div>
            <div className="section-sub">Scroll through random formulas and notes.</div>
            {reelItems.length === 0 ? (
              <div className="empty">No formulas or notes available for reel mode.</div>
            ) : (
              <div className="reel-overlay">
                {reelItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`reel-card reel-full ${item.type}-type ${idx === reelIndex ? 'visible' : ''} ${isTransitioning ? 'transitioning' : ''}`}
                    aria-hidden={idx === reelIndex ? 'false' : 'true'}
                  >
                    <div className="entry-head">
                      <div className="entry-title">{item.type.toUpperCase()}</div>
                      <span className="type-tag">{item.type}</span>
                    </div>
                    <div className="entry-content" style={{ fontSize: '1.25rem' }}>
                      {renderContentText(item.content)}
                    </div>
                    <div className="entry-note">Swipe, wheel, or press ↑/↓ to navigate</div>
                  </div>
                ))}

                <div className="reel-controls">
                  <button onClick={prevReel} className="reel-nav">↑</button>
                  <div className="reel-counter">{reelIndex + 1}/{reelItems.length}</div>
                  <button onClick={nextReel} className="reel-nav">↓</button>
                </div>
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: '14px' }}>
              <button className="btn-cancel" onClick={() => setReelSeed(Date.now())}>
                Refresh reel
              </button>
            </div>
          </>
        ) : (
          <div className="grid">
            {error && <div className="empty">{error}</div>}
            {filteredItems.length === 0 && !error ? (
              <div className="empty">No entries yet. Add a formula, note or reel item above.</div>
            ) : (
              filteredItems.map((item) => (
                <div key={item.id} className={`entry ${item.type}-type`}>
                  <div className="entry-head">
                    <div className="entry-title">{item.type.toUpperCase()}</div>
                    <span className="type-tag">{item.type}</span>
                  </div>
                  <div className="entry-content">{renderContentText(item.content)}</div>
                  <div className="entry-actions">
                    <button onClick={() => startEdit(item)}>Edit</button>
                    <button className="danger" onClick={() => deleteItem(item.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <section className="card" style={{ marginTop: '24px' }}>
          <div className="field-row">
            <div className="field">
              <label>Entry type</label>
              <select value={newType} onChange={(event) => setNewType(event.target.value)}>
                <option value="formula">Formula</option>
                <option value="note">Note</option>
                <option value="reel">Reel</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Item content</label>
            <textarea
              value={newContent}
              onChange={(event) => setNewContent(event.target.value)}
              placeholder="Enter a formula, note, or short reel prompt"
            />
          </div>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={() => setNewContent('')}>
              Clear
            </button>
            <button className="btn-save" onClick={addItem} disabled={loading || !newContent.trim()}>
              Save item
            </button>
          </div>
        </section>

        {editingId && (
          <section className="card" style={{ marginTop: '18px' }}>
            <h3>Edit item</h3>
            <div className="field">
              <label>Updated content</label>
              <textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setEditingId(null)}>
                Cancel
              </button>
              <button className="btn-save" onClick={saveEdit} disabled={!editContent.trim()}>
                Save changes
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
