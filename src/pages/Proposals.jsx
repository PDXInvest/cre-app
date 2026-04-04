export default function Proposals() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>Proposals</h1>
        <button style={{ padding: '8px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500 }}>
          + New proposal
        </button>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '3rem', textAlign: 'center', color: '#888' }}>
        No proposals yet. Click "+ New proposal" to get started.
      </div>
    </div>
  )
}