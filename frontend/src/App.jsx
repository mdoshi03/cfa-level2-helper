import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, supabaseError } from './supabaseClient.js'
import 'katex/dist/katex.min.css'
import { BlockMath, InlineMath } from 'react-katex'

const itemTypes = [
  { value: 'All', label: 'All entries' },
  { value: 'formula', label: 'Formula' },
  { value: 'note', label: 'Note' },
  { value: 'reel', label: 'Reel' },
]

const categories = [
  { value: 'valuation', label: 'Valuation' },
  { value: 'econometrics', label: 'Econometrics' },
  { value: 'international finance', label: 'International Finance' },
  { value: 'fixed income', label: 'Fixed Income' },
  { value: 'real estate', label: 'Real Estate' },
  { value: 'performance', label: 'Performance' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'derivatives', label: 'Derivatives' },
  { value: 'credit', label: 'Credit' },
  { value: 'risk', label: 'Risk' },
  { value: 'alternative', label: 'Alternative' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'ethics', label: 'Ethics' },
  { value: 'general', label: 'General' },
]

function titleCase(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function renderContentText(content) {
  const tokens = content.split('\n')
  return tokens.map((token, idx) => {
    const trimmed = token.trim()
    if (!trimmed) return <div key={idx} style={{ marginBottom: '6px' }}>{trimmed}</div>
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
      const math = trimmed.slice(2, -2)
      return (
        <div key={idx} style={{ marginBottom: '8px' }}>
          <BlockMath>{math}</BlockMath>
        </div>
      )
    }
    if (/\\\$.*\\$/g.test(trimmed)) {
      return (
        <div key={idx} style={{ marginBottom: '8px' }}>
          <InlineMath>{trimmed.replace(/\\\$/g, '$')}</InlineMath>
        </div>
      )
    }
    return (
      <div key={idx} style={{ marginBottom: '6px', whiteSpace: 'pre-wrap' }}>
        {trimmed}
      </div>
    )
  })
}

function App() {
  const [items, setItems] = useState([])
  const [activeType, setActiveType] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [newType, setNewType] = useState('formula')
  const [newCategory, setNewCategory] = useState(categories[0].label)
  const [categoryOptions, setCategoryOptions] = useState(categories.map(({ label }) => ({ value: label, label })))
  const [newContent, setNewContent] = useState('')
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editCategory, setEditCategory] = useState('valuation')
  const [reelSeed, setReelSeed] = useState(Date.now())
  const [showAddForm, setShowAddForm] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [reelIndex, setReelIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const lastNavRef = useRef({ last: 0 })
  const reelOverlayRef = useRef(null)

  useEffect(() => {
    loadItems()
  }, [])

  async function loadItems() {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase.from('items').select('*').order('id', { ascending: false })
    if (fetchError) {
      setError(fetchError.message)
    } else {
      const normalizedItems = (data ?? []).map((item) => ({
        ...item,
        category: item.category ? titleCase(item.category) : item.category,
      }))
      setItems(normalizedItems)

      const savedCategories = Array.from(
        new Set(normalizedItems.filter((item) => item.category).map((item) => item.category))
      )
      const additionalCategories = savedCategories.filter(
        (category) => !categoryOptions.some((option) => option.value.toLowerCase() === category.toLowerCase())
      )
      if (additionalCategories.length) {
        setCategoryOptions((prev) => [
          ...prev,
          ...additionalCategories.map((category) => ({ value: category, label: category })),
        ])
      }
    }
    setLoading(false)
  }

  async function addItem() {
    if (!newContent.trim()) return
    setLoading(true)
    setError(null)
    const normalizedCategory = titleCase(newCategory || 'General')
    if (!categoryOptions.some((option) => option.value.toLowerCase() === normalizedCategory.toLowerCase())) {
      setCategoryOptions((prev) => [...prev, { value: normalizedCategory, label: normalizedCategory }])
    }
    const { error: insertError } = await supabase.from('items').insert([
      { type: newType, category: normalizedCategory, content: newContent.trim() },
    ])
    if (insertError) {
      setError(insertError.message)
    } else {
      setNewContent('')
      setNewCategory(normalizedCategory)
      loadItems()
    }
    setLoading(false)
  }

  async function startEdit(item) {
    setEditingId(item.id)
    setEditContent(item.content)
    setEditCategory(item.category || 'general')
  }

  async function saveEdit() {
    if (!editContent.trim()) return
    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase.from('items').update({ content: editContent.trim(), category: editCategory }).eq('id', editingId)
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
      const matchesSearch = !query || item.content.toLowerCase().includes(query) || item.type.toLowerCase().includes(query)
      return matchesType && matchesSearch
    })
  }, [activeType, items, searchTerm])

  const groupedFormulaItems = useMemo(() => {
    if (activeType !== 'formula') return []
    const byCategory = filteredItems.reduce((acc, item) => {
      const category = (item.category || 'general').toLowerCase()
      if (!acc[category]) acc[category] = []
      acc[category].push(item)
      return acc
    }, {})
    return categories.map(({ value, label }) => ({ value, label, items: byCategory[value] ?? [] })).filter((group) => group.items.length > 0)
  }, [activeType, filteredItems])

  const groupedNoteItems = useMemo(() => {
    if (activeType !== 'note') return []
    const byCategory = filteredItems.reduce((acc, item) => {
      const category = (item.category || 'general').toLowerCase()
      if (!acc[category]) acc[category] = []
      acc[category].push(item)
      return acc
    }, {})
    return categories.map(({ value, label }) => ({ value, label, items: byCategory[value] ?? [] })).filter((group) => group.items.length > 0)
  }, [activeType, filteredItems])

  const reelItems = useMemo(() => {
    const pool = items.filter((item) => item.type === 'formula' || item.type === 'note')
    return [...pool].sort(() => Math.random() - 0.5)
  }, [items, reelSeed])

  function toggleGroup(category) {
    setCollapsedGroups((prev) => ({ ...prev, [category]: !prev[category] }))
  }

  function collapseAll(groups) {
    const map = {}
    groups.forEach((g) => {
      map[g] = true
    })
    setCollapsedGroups(map)
  }

  function expandAll(groups) {
    const map = {}
    groups.forEach((g) => {
      map[g] = false
    })
    setCollapsedGroups(map)
  }

  function clampIndex(i) {
    if (!reelItems || reelItems.length === 0) return 0
    if (i < 0) return 0
    if (i >= reelItems.length) return reelItems.length - 1
    return i
  }

  function goToIndex(i) {
    const now = Date.now()
    if (now - lastNavRef.current.last < 350) return
    lastNavRef.current.last = now
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

  useEffect(() => {
    if (activeType !== 'reel') return
    let touchStartY = null
    const overlay = reelOverlayRef.current

    function onWheel(e) {
      e.preventDefault()
      if (e.deltaY > 10) nextReel()
      else if (e.deltaY < -10) prevReel()
    }
    function onKey(e) {
      if (e.key === 'ArrowDown') nextReel()
      if (e.key === 'ArrowUp') prevReel()
    }
    if (overlay) {
      overlay.addEventListener('wheel', onWheel, { passive: false })
      window.addEventListener('keydown', onKey)
    }
    return () => {
      if (overlay) overlay.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
    }
  }, [activeType, reelItems, reelIndex])

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
              <button type="button" className={activeType === type.value ? 'active' : ''} onClick={() => setActiveType(type.value)}>
                <span>{type.label}</span>
                <span className="count">{type.value === 'All' ? items.length : items.filter((item) => item.type === type.value).length}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="sidebar-footer">
          <button type="button" onClick={() => setSearchTerm('')}>Clear search</button>
          <div className="sync-status">
            <span className="sync-dot on" />
            <span>Live Supabase data</span>
          </div>
        </div>
      </nav>

      <main>
        {activeType !== 'reel' && (
          <div className="topbar">
            <div className="search">
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search formulas or notes…" />
            </div>
            <button type="button" className="add-btn" onClick={() => setShowAddForm((open) => !open)} aria-expanded={showAddForm}>
              {showAddForm ? 'Close add form' : '+ Add item'}
            </button>
          </div>
        )}

        {activeType !== 'reel' && showAddForm && (
          <section className="card add-card" style={{ marginTop: '18px' }}>
            <div className="field-row">
              <div className="field">
                <label>Entry type</label>
                <select value={newType} onChange={(event) => setNewType(event.target.value)}>
                  <option value="formula">Formula</option>
                  <option value="note">Note</option>
                </select>
              </div>
              <div className="field">
                <label>Category</label>
                <select value={newCategory} onChange={(event) => setNewCategory(event.target.value)}>
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Item content</label>
              <textarea value={newContent} onChange={(event) => setNewContent(event.target.value)} placeholder="Enter a formula, note, or short reel prompt" />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setNewContent('')}>
                Clear
              </button>
              <button type="button" className="btn-save" onClick={addItem} disabled={loading || !newContent.trim()}>
                Save item
              </button>
            </div>
          </section>
        )}

        {activeType === 'reel' ? (
          <>
            <div className="section-title">Reel scroll</div>
            <div className="section-sub">Scroll through random formulas and notes.</div>
            {reelItems.length === 0 ? (
              <div className="empty">No formulas or notes available for reel mode.</div>
            ) : (
              <div className="reel-overlay" ref={reelOverlayRef}>
                {reelItems.map((item, idx) => (
                  <div key={item.id} className={`reel-card reel-full ${item.type}-type ${idx === reelIndex ? 'visible' : ''} ${isTransitioning ? 'transitioning' : ''}`} aria-hidden={idx === reelIndex ? 'false' : 'true'}>
                    <div className="entry-head">
                      <div className="entry-title">{item.category ? item.category.toUpperCase() : item.type.toUpperCase()}</div>
                      <span className="type-tag">{item.type}</span>
                    </div>
                    <div className="entry-content" style={{ fontSize: '1.25rem' }}>{renderContentText(item.content)}</div>
                    <div className="entry-note">Swipe, wheel, or press ↑/↓ to navigate</div>
                  </div>
                ))}

                <div className="reel-controls">
                  <button type="button" onClick={prevReel} className="reel-nav">↑</button>
                  <div className="reel-counter">
                    {reelIndex + 1}/{reelItems.length}
                  </div>
                  <button type="button" onClick={nextReel} className="reel-nav">↓</button>
                </div>
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: '14px' }}>
              <button type="button" className="btn-cancel" onClick={() => setReelSeed(Date.now())}>
                Refresh reel
              </button>
            </div>
          </>
        ) : (
          <div className="grid">
            {error && <div className="empty">{error}</div>}
            {filteredItems.length === 0 && !error ? (
              <div className="empty">No entries yet. Add a formula or note above.</div>
            ) : activeType === 'formula' ? (
              groupedFormulaItems.length === 0 ? (
                <div className="empty">No formula entries available in this category.</div>
              ) : (
                <>
                  <div className="group-controls">
                    <button type="button" onClick={() => collapseAll(groupedFormulaItems.map((g) => g.value))}>Collapse all</button>
                    <button type="button" onClick={() => expandAll(groupedFormulaItems.map((g) => g.value))}>Expand all</button>
                  </div>
                  {groupedFormulaItems.map((group) => {
                    const isCollapsed = !!collapsedGroups[group.value]
                    return (
                      <div key={group.value}>
                        <div className="category-heading" onClick={() => toggleGroup(group.value)}>
                          <span>{group.label} ({group.items.length})</span>
                          <span className="category-toggle">{isCollapsed ? '+' : '−'}</span>
                        </div>
                        {!isCollapsed && (
                          <div className="grid">
                            {group.items.map((item) => {
                              const isEditing = editingId === item.id
                              return (
                                <div key={item.id} className={`entry ${item.type}-type`}>
                                  <div className="entry-head">
                                    <div>
                                      <div className="entry-title">{item.category ? item.category.toUpperCase() : item.type.toUpperCase()}</div>
                                      <span className="type-tag">{item.type}</span>
                                    </div>
                                  </div>
                                  <div className="entry-content">
                                    {isEditing ? (
                                      <>
                                        <div style={{ marginBottom: '10px' }}>
                                          <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '6px', color: '#5f6b7f' }}>
                                            Category
                                          </label>
                                          <select value={editCategory} onChange={(event) => setEditCategory(event.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '2px', border: '1px solid #ccc' }}>
                                            {categories.map((category) => (
                                              <option key={category.value} value={category.value}>
                                                {category.label}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} style={{ minHeight: '120px', width: '100%', resize: 'vertical' }} />
                                      </>
                                    ) : (
                                      renderContentText(item.content)
                                    )}
                                  </div>
                                  <div className="entry-actions">
                                    {isEditing ? (
                                      <>
                                        <button type="button" className="btn-save" onClick={saveEdit} disabled={!editContent.trim()}>
                                          Save
                                        </button>
                                        <button type="button" className="btn-cancel" onClick={() => setEditingId(null)}>
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button type="button" onClick={() => startEdit(item)}>Edit</button>
                                        <button type="button" className="danger" onClick={() => deleteItem(item.id)}>
                                          Delete
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )
            ) : activeType === 'note' ? (
              groupedNoteItems.length === 0 ? (
                <div className="empty">No note entries available in this category.</div>
              ) : (
                <>
                  <div className="group-controls">
                    <button type="button" onClick={() => collapseAll(groupedNoteItems.map((g) => g.value))}>Collapse all</button>
                    <button type="button" onClick={() => expandAll(groupedNoteItems.map((g) => g.value))}>Expand all</button>
                  </div>
                  {groupedNoteItems.map((group) => {
                    const isCollapsed = !!collapsedGroups[group.value]
                    return (
                      <div key={group.value}>
                        <div className="category-heading" onClick={() => toggleGroup(group.value)}>
                          <span>{group.label} ({group.items.length})</span>
                          <span className="category-toggle">{isCollapsed ? '+' : '−'}</span>
                        </div>
                        {!isCollapsed && (
                          <div className="grid">
                            {group.items.map((item) => {
                              const isEditing = editingId === item.id
                              return (
                                <div key={item.id} className={`entry ${item.type}-type`}>
                                  <div className="entry-head">
                                    <div>
                                      <div className="entry-title">{item.category ? item.category.toUpperCase() : item.type.toUpperCase()}</div>
                                      <span className="type-tag">{item.type}</span>
                                    </div>
                                  </div>
                                  <div className="entry-content">
                                    {isEditing ? (
                                      <>
                                        <div style={{ marginBottom: '10px' }}>
                                          <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '6px', color: '#5f6b7f' }}>
                                            Category
                                          </label>
                                          <select value={editCategory} onChange={(event) => setEditCategory(event.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '2px', border: '1px solid #ccc' }}>
                                            {categories.map((category) => (
                                              <option key={category.value} value={category.value}>
                                                {category.label}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} style={{ minHeight: '120px', width: '100%', resize: 'vertical' }} />
                                      </>
                                    ) : (
                                      renderContentText(item.content)
                                    )}
                                  </div>
                                  <div className="entry-actions">
                                    {isEditing ? (
                                      <>
                                        <button type="button" className="btn-save" onClick={saveEdit} disabled={!editContent.trim()}>
                                          Save
                                        </button>
                                        <button type="button" className="btn-cancel" onClick={() => setEditingId(null)}>
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button type="button" onClick={() => startEdit(item)}>Edit</button>
                                        <button type="button" className="danger" onClick={() => deleteItem(item.id)}>
                                          Delete
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )
            ) : (
              filteredItems.map((item) => {
                const isEditing = editingId === item.id
                return (
                  <div key={item.id} className={`entry ${item.type}-type`}>
                    <div className="entry-head">
                      <div>
                        <div className="entry-title">{item.category ? item.category.toUpperCase() : item.type.toUpperCase()}</div>
                        <span className="type-tag">{item.type}</span>
                      </div>
                    </div>
                    <div className="entry-content">
                      {isEditing ? (
                        <>
                          <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '6px', color: '#5f6b7f' }}>
                              Category
                            </label>
                            <select value={editCategory} onChange={(event) => setEditCategory(event.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '2px', border: '1px solid #ccc' }}>
                              {categories.map((category) => (
                                <option key={category.value} value={category.value}>
                                  {category.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} style={{ minHeight: '120px', width: '100%', resize: 'vertical' }} />
                        </>
                      ) : (
                        renderContentText(item.content)
                      )}
                    </div>
                    <div className="entry-actions">
                      {isEditing ? (
                        <>
                          <button type="button" className="btn-save" onClick={saveEdit} disabled={!editContent.trim()}>
                            Save
                          </button>
                          <button type="button" className="btn-cancel" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEdit(item)}>Edit</button>
                          <button type="button" className="danger" onClick={() => deleteItem(item.id)}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
