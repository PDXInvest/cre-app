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
      <button className="btn-pdf" onClick={() => fileRef.current?.click()} disabled={extracting}>
        {extracting ? 'Extracting…' : '⇪ Import from PDF'}
      </button>
    </>
  )
}
