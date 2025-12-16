'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SignatureManager from '../../components/SignatureManager'
import PdfSigner from '../../components/PdfSigner'

export default function Dashboard() {
    const [user, setUser] = useState<any>(null)
    const [docs, setDocs] = useState<any[]>([])
    const [uploading, setUploading] = useState(false)

    // State for Modals
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false)
    const [signDoc, setSignDoc] = useState<any>(null)
    const [shareModalOpen, setShareModalOpen] = useState(false)

    // Share State
    const [shareDocId, setShareDocId] = useState<string | null>(null)
    const [shareEmail, setShareEmail] = useState('')

    const router = useRouter()

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) {
            window.location.href = '/login'
            return
        }
        fetchProfile(token)
        fetchDocs(token)
    }, [])

    const fetchProfile = async (token: string) => {
        const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
            const data = await res.json()
            setUser(data)
            if (data.role === 'ADMIN') router.push('/admin')
        } else {
            handleLogout()
        }
    }

    const fetchDocs = async (token?: string) => {
        const t = token || localStorage.getItem('token')
        if (!t) return
        const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/documents', {
            headers: { Authorization: `Bearer ${t}` }
        })
        if (res.ok) setDocs(await res.json())
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return
        setUploading(true)
        const formData = new FormData()
        formData.append('file', e.target.files[0])

        const token = localStorage.getItem('token')
        try {
            const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/documents/upload', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            })
            if (!res.ok) {
                const data = await res.json()
                alert('Upload failed: ' + (data.message || res.statusText))
            } else {
                alert('Upload successful!')
                // Close modal if open (via reference or re-render)
                const modal = document.getElementById('upload_modal') as HTMLDialogElement
                if (modal) modal.close()
            }
        } catch (err: any) {
            alert('Upload error: ' + err.message)
        } finally {
            setUploading(false)
            fetchDocs()
            e.target.value = ''
        }
    }

    const handleShare = async () => {
        if (!shareDocId || !shareEmail) return
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/${shareDocId}/share`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: shareEmail })
            })

            if (!res.ok) throw new Error('Failed to share')
            alert('Document shared successfully!')
            setShareModalOpen(false)
            setShareEmail('')
            fetchDocs()
        } catch (err) {
            alert('Error sharing document')
        }
    }

    const openShareModal = (docId: string) => {
        setShareDocId(docId)
        setShareModalOpen(true)
    }

    const openSignModal = (doc: any) => {
        setSignDoc(doc)
    }

    const handleSign = async (page: number, x: number, y: number, width: number, height: number) => {
        if (!signDoc) return
        const token = localStorage.getItem('token')

        const res = await fetch(process.env.NEXT_PUBLIC_API_URL + `/documents/${signDoc.id}/sign`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ page, x, y, width, height, reason: 'Visual Sign' })
        })

        if (res.ok) {
            alert('Signing queued!')
            setSignDoc(null)
            fetchDocs()
        } else {
            const data = await res.json().catch(() => ({}))
            alert('Failed to queue signing: ' + (data.message || res.statusText))
        }
    }

    const handleLogout = () => {
        localStorage.clear()
        window.location.href = '/login'
    }

    const handleDownload = async (doc: any) => {
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/${doc.id}/download`, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                alert('Download failed: ' + (data.message || res.statusText))
                return
            }

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            // Try to use filename from header or fallback
            // Content-Disposition: attachment; filename="signed_..."
            const disposition = res.headers.get('Content-Disposition')
            let filename = doc.filename
            if (disposition && disposition.includes('filename=')) {
                const match = disposition.match(/filename="?([^"]+)"?/)
                if (match && match[1]) filename = match[1]
            }

            a.download = filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (e) {
            alert('Download error')
        }
    }

    if (!user) return <div className="container" style={{ padding: '2rem' }}>Loading...</div>

    return (
        <div className="container" style={{ padding: '2rem 1rem' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Dashboard</h1>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{user.name} ({user.email})</span>
                    <button className="btn" style={{ border: '1px solid #777' }} onClick={handleLogout}>Logout</button>
                </div>
            </header>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card">
                    <h3 style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '0.5rem' }}>TOTAL DOCUMENTS</h3>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{docs.length}</p>
                </div>
                <div className="card">
                    <h3 style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '0.5rem' }}>SIGNED</h3>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0, color: '#4ade80' }}>
                        {docs.filter(d => d.status === 'SIGNED').length}
                    </p>
                </div>
                <div className="card">
                    <h3 style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '0.5rem' }}>PENDING</h3>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0, color: '#facc15' }}>
                        {docs.filter(d => d.status !== 'SIGNED').length}
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <button
                    onClick={() => {
                        const uploadModal = document.getElementById('upload_modal') as HTMLDialogElement;
                        if (uploadModal) uploadModal.showModal();
                    }}
                    className="btn btn-primary"
                >
                    Upload Document
                </button>
                <button
                    onClick={() => setIsSignatureModalOpen(true)}
                    className="btn"
                    style={{ background: '#334155' }}
                >
                    Manage Signature
                </button>
            </div>

            {/* Documents Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                        <tr>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: '#aaa', textTransform: 'uppercase' }}>Filename</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: '#aaa', textTransform: 'uppercase' }}>Owner / Status</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: '#aaa', textTransform: 'uppercase' }}>Shared With</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: '#aaa', textTransform: 'uppercase' }}>Date</th>
                            <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', color: '#aaa', textTransform: 'uppercase' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {docs.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                                    No documents found. Upload one to get started.
                                </td>
                            </tr>
                        )}
                        {docs.map((doc: any) => (
                            <tr key={doc.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ fontWeight: 500 }}>{doc.filename}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>{doc.id.substring(0, 8)}...</div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <span className={`badge ${doc.status === 'SIGNED' ? 'badge-green' : doc.status === 'FAILED' ? 'badge-red' : 'badge-yellow'}`}>
                                        {doc.status}
                                    </span>
                                    {doc.user && (
                                        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.3rem' }}>
                                            {doc.user.email === user.email ? 'Me' : doc.user.email}
                                        </div>
                                    )}
                                </td>
                                <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#ccc' }}>
                                    {doc.access && doc.access.length > 0 ? (
                                        doc.access.map((a: any) => a.user_email).join(', ')
                                    ) : '-'}
                                </td>
                                <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#ccc' }}>
                                    {new Date(doc.created_at).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <button
                                        onClick={() => handleDownload(doc)}
                                        style={{ color: '#818cf8', marginRight: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        Download
                                    </button>

                                    <button
                                        onClick={() => openSignModal(doc)}
                                        style={{ color: '#4ade80', marginRight: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        Sign
                                    </button>

                                    <button
                                        onClick={() => openShareModal(doc.id)}
                                        style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        Share
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Upload Modal (Using native dialog for simplicity) */}
            <dialog id="upload_modal" style={{ padding: '2rem', borderRadius: '12px', border: 'none', background: '#1e293b', color: 'white', backdropFilter: 'blur(10px)' }}>
                <div style={{ width: '400px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Upload Document</h3>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <input
                            type="file"
                            accept="application/pdf"
                            onChange={handleFileUpload}
                            style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: 'white' }}
                        />
                        {uploading && <p style={{ color: '#aaa', marginTop: '0.5rem' }}>Uploading...</p>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <form method="dialog">
                            <button className="btn">Close</button>
                        </form>
                    </div>
                </div>
            </dialog>

            {/* Share Modal */}
            {shareModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                    <div className="card" style={{ width: '400px', background: '#1e293b' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Share Document</h3>
                        <p style={{ color: '#aaa', marginBottom: '1rem', fontSize: '0.9rem' }}>Enter the email address of the user you want to share this with.</p>
                        <input
                            type="email"
                            placeholder="user@example.com"
                            className="input"
                            value={shareEmail}
                            onChange={e => setShareEmail(e.target.value)}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button onClick={() => setShareModalOpen(false)} className="btn" style={{ background: 'transparent' }}>Cancel</button>
                            <button onClick={handleShare} className="btn btn-primary">Share</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Signature Manager Modal */}
            {isSignatureModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                    <div className="card" style={{ width: '95%', maxWidth: '600px', background: 'white', color: 'black', position: 'relative' }}>
                        <button
                            onClick={() => setIsSignatureModalOpen(false)}
                            style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
                        >
                            ✕
                        </button>
                        <SignatureManager
                            token={localStorage.getItem('token')!}
                            onSaved={() => fetchProfile(localStorage.getItem('token')!)}
                            onClose={() => setIsSignatureModalOpen(false)}
                        />
                    </div>
                </div>
            )}

            {/* PDF Signer Modal */}
            {signDoc && (
                <PdfSigner
                    docId={signDoc.id}
                    token={localStorage.getItem('token')!}
                    onClose={() => setSignDoc(null)}
                    onSign={handleSign}
                />
            )}
        </div>
    )
}
