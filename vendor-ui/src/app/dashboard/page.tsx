'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
    const [user, setUser] = useState<any>(null)
    const [docs, setDocs] = useState<any[]>([])
    const [uploading, setUploading] = useState(false)
    const router = useRouter()

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) return router.push('/login')

        // Check role, if admin go to admin
        // Basic JWT decode or fetch profile
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
            // Simple role check
            if (data.role === 'ADMIN') router.push('/admin')
        } else {
            router.push('/login')
        }
    }

    const fetchDocs = async (token: string) => {
        const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/docs', {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) setDocs(await res.json())
    }

    const requestCert = async () => {
        const token = localStorage.getItem('token')
        const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/cert/request', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (res.ok) {
            alert('Certificate issued! Serial: ' + data.serial)
            fetchProfile(token!)
        } else {
            alert(data.message)
        }
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return
        setUploading(true)
        const formData = new FormData()
        formData.append('file', e.target.files[0])

        const token = localStorage.getItem('token')
        await fetch(process.env.NEXT_PUBLIC_API_URL + '/documents/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        })
        setUploading(false)
        fetchDocs(token!)
        e.target.value = ''
    }

    const signDoc = async (id: string) => {
        const token = localStorage.getItem('token')
        // Hardcoded coords for demo as per Requirement "page, x, y"
        // In real UI we'd have a PDF viewer select.
        const coords = prompt('Enter Page,X,Y,W,H (e.g. 1,100,100,200,50)', '1,100,100,200,50')
        if (!coords) return
        const [page, x, y, width, height] = coords.split(',').map(Number)

        const res = await fetch(process.env.NEXT_PUBLIC_API_URL + `/documents/${id}/sign`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ page, x, y, width, height, reason: 'Demo Sign' })
        })

        if (res.ok) {
            alert('Signing queued!')
            fetchDocs(token!)
        } else {
            alert('Failed to queue signing')
        }
    }

    const downloadDoc = async (id: string, name: string) => {
        const token = localStorage.getItem('token')
        const res = await fetch(process.env.NEXT_PUBLIC_API_URL + `/documents/${id}/download`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `signed_${name}` // simplified
            a.click()
        } else {
            alert('Not signed yet or error')
        }
    }

    if (!user) return <div className="container p-10">Loading...</div>

    return (
        <div className="container" style={{ padding: '2rem 1rem' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h2>Dashboard</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span>{user.name}</span>
                    <button className="btn" onClick={() => { localStorage.clear(); router.push('/login') }}>Logout</button>
                </div>
            </header>

            <section className="card">
                <h3>Identity Status</h3>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '2rem' }}>
                    <div>
                        <label>KYC Status</label>
                        <div style={{ marginTop: '0.5rem' }}>
                            <span className={`badge ${user.status === 'VERIFIED' ? 'badge-green' : 'badge-yellow'}`}>{user.status}</span>
                        </div>
                    </div>
                    <div>
                        <label>Certificate</label>
                        <div style={{ marginTop: '0.5rem' }}>
                            {user.certificates?.length > 0 ? (
                                <span className="badge badge-green">Issued ({user.certificates[0].serial.substring(0, 8)}...)</span>
                            ) : (
                                user.status === 'VERIFIED' ?
                                    <button className="btn btn-primary" onClick={requestCert} style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>Request Certificate</button>
                                    : <span className="text-gray-400">Waiting for KYC</span>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h3>Documents</h3>
                    <div>
                        <input type="file" id="upload" hidden onChange={handleUpload} accept="application/pdf" />
                        <label htmlFor="upload" className="btn btn-primary">
                            {uploading ? 'Uploading...' : 'Upload PDF'}
                        </label>
                    </div>
                </div>

                <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                            <th style={{ padding: '1rem' }}>Filename</th>
                            <th style={{ padding: '1rem' }}>Date</th>
                            <th style={{ padding: '1rem' }}>Status</th>
                            <th style={{ padding: '1rem' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {docs.map(doc => (
                            <tr key={doc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '1rem' }}>{doc.filename}</td>
                                <td style={{ padding: '1rem' }}>{new Date(doc.created_at).toLocaleDateString()}</td>
                                <td style={{ padding: '1rem' }}>
                                    <span className={`badge ${doc.status === 'SIGNED' ? 'badge-green' : 'badge-yellow'}`}>{doc.status}</span>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    {doc.status === 'UPLOADED' && (
                                        <button className="btn btn-primary" onClick={() => signDoc(doc.id)}>Sign</button>
                                    )}
                                    {doc.status === 'SIGNED' && (
                                        <button className="btn" onClick={() => downloadDoc(doc.id, doc.filename)}>Download</button>
                                    )}
                                    {doc.status === 'SIGNING' && (
                                        <span style={{ opacity: 0.7 }}>Processing...</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    )
}
