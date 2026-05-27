import { useState, useRef } from 'react'
import { extractPdf } from '../utils/pdfExtract'

export default function PdfImportButton({ type, onExtracted, onError }) {
  const [extracting, setExtracting] = useState(false)
  const fileRef = useRef()

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    fileRef.current.value = ''
    setExtracting(true)
    try {
      const data = await extractPdf(file, type)
      onExtracted(data)
    } catch (err) {
      onError(err.message)
    } finally {
      setExtracting(false)
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".pdf,application/pdf" onChange={handleFile} style={{ display: 'none' }} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={extracting}
        style={{ padding: '6px 14px', background: '#fff', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: extracting ? 'not-allowed' : 'pointer', opacity: extracting ? 0.6 : 1 }}
      >
        {extracting ? 'Extracting...' : 'Import from PDF'}
      </button>
    </>
  )
}
