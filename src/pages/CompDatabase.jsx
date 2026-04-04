export default function CompDatabase() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>Comp database</h1>
        <button style={{ padding: '8px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500 }}>
          Import comps
        </button>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '3rem', textAlign: 'center', color: '#888' }}>
        No comps imported yet. Click "Import comps" to get started.
      </div>
    </div>
  )
}