'use client'
import React, { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'

interface Props {
    token: string
    onSaved: () => void
    onClose: () => void
}

export default function SignatureManager({ token, onSaved, onClose }: Props) {
    const [mode, setMode] = useState<'DRAW' | 'UPLOAD' | 'VIEW'>('DRAW')
    const sigPad = useRef<any>(null)
    const [file, setFile] = useState<File | null>(null)
    const [saving, setSaving] = useState(false)
    const [existingSigUrl, setExistingSigUrl] = useState<string | null>(null)

    React.useEffect(() => {
        // Fetch existing signature
        fetch(process.env.NEXT_PUBLIC_API_URL + '/auth/signature/image', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(async res => {
                if (res.ok) {
                    const blob = await res.blob()
                    setExistingSigUrl(URL.createObjectURL(blob))
                    setMode('VIEW')
                }
            })
            .catch(() => { })
    }, [token])

    const clear = () => sigPad.current?.clear()

    const saveDraw = async () => {
        if (sigPad.current?.isEmpty()) return alert('Please draw a signature')
        // Get blob
        const canvas = sigPad.current.getCanvas()
        canvas.toBlob(async (blob: Blob) => {
            await upload(blob)
        })
    }

    const saveUpload = async () => {
        if (!file) return alert('Please select a file')
        await upload(file)
    }

    const upload = async (blob: Blob) => {
        setSaving(true)
        const formData = new FormData()
        formData.append('file', blob, 'signature.png')

        try {
            const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/auth/signature', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            })
            if (res.ok) {
                // After saving image, request certificate
                const certRes = await fetch(process.env.NEXT_PUBLIC_API_URL + '/cert/request', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                })

                if (certRes.ok || certRes.status === 400) { // 400 if already issued, which is fine
                    alert('Signature saved & Certificate issued!')
                    onSaved()
                    onClose()
                } else {
                    const data = await certRes.json().catch(() => ({}))
                    alert('Signature saved but failed to issue certificate: ' + (data.message || certRes.statusText))
                }
            } else {
                alert('Failed to save signature')
            }
        } catch (e) {
            alert('Error saving signature')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>Setup Signature</h3>
                <div style={{ margin: '1rem 0', display: 'flex', gap: '1rem' }}>
                    <button className={mode === 'DRAW' ? 'btn btn-primary' : 'btn'} onClick={() => setMode('DRAW')}>Draw</button>
                    <button className={mode === 'UPLOAD' ? 'btn btn-primary' : 'btn'} onClick={() => setMode('UPLOAD')}>Upload Image</button>
                    {existingSigUrl && (
                        <button className={mode === 'VIEW' ? 'btn btn-primary' : 'btn'} onClick={() => setMode('VIEW')}>Current Signature</button>
                    )}
                </div>

                {mode === 'VIEW' && existingSigUrl && (
                    <div style={{ textAlign: 'center', padding: '1rem', border: '1px solid #ddd' }}>
                        <img src={existingSigUrl} alt="Current Signature" style={{ maxWidth: '100%', maxHeight: '200px' }} />
                        <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'green' }}>✓ This signature is currently active</div>
                    </div>
                )}

                {mode === 'DRAW' && (
                    <div style={{ border: '1px solid #ccc', backgroundColor: '#fff' }}>
                        <SignatureCanvas ref={sigPad} canvasProps={{ width: 500, height: 200, className: 'sigCanvas' }} />
                        <div style={{ padding: '0.5rem' }}>
                            <button className="btn" onClick={clear} style={{ fontSize: '0.8rem' }}>Clear</button>
                        </div>
                    </div>
                )}

                {mode === 'UPLOAD' && (
                    <div style={{ padding: '2rem', border: '1px dashed #ccc', textAlign: 'center' }}>
                        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} accept="image/*" />
                        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>Upload a PNG/JPG of your signature (transparent background recommended)</p>
                    </div>
                )}

                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button className="btn" onClick={onClose}>Cancel</button>
                    {mode !== 'VIEW' && (
                        <button className="btn btn-primary" onClick={mode === 'DRAW' ? saveDraw : saveUpload} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Signature'}
                        </button>
                    )}
                </div>
            </div>
            <style jsx>{`
                .modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex; align-items: center; justifyContent: center;
                    z-index: 1000;
                }
                .modal-content {
                    background: var(--card-bg, white);
                    padding: 2rem;
                    border-radius: 8px;
                    width: 90%;
                    max-width: 600px;
                }
            `}</style>
        </div>
    )
}
