'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
    const [users, setUsers] = useState<any[]>([])
    const [logs, setLogs] = useState<any[]>([])
    const router = useRouter()

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) return router.push('/login')
        fetchData(token)
    }, [])

    const fetchData = async (token: string) => {
        const userRes = await fetch(process.env.NEXT_PUBLIC_API_URL + '/admin/users?status=PENDING', {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (userRes.ok) setUsers(await userRes.json())

        const logRes = await fetch(process.env.NEXT_PUBLIC_API_URL + '/admin/audit', {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (logRes.ok) setLogs(await logRes.json())
    }

    const verifyUser = async (id: string, action: 'verify' | 'reject') => {
        const token = localStorage.getItem('token')
        const res = await fetch(process.env.NEXT_PUBLIC_API_URL + `/admin/users/${id}/${action}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) fetchData(token!)
    }

    return (
        <div className="container" style={{ padding: '2rem 1rem' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h2>Admin Console</h2>
                <button className="btn" onClick={() => { localStorage.clear(); router.push('/login') }}>Logout</button>
            </header>

            <section className="card">
                <h3>Pending KYC Verifications</h3>
                {users.length === 0 ? <p style={{ opacity: 0.5, marginTop: '1rem' }}>No pending users.</p> : (
                    <table style={{ width: '100%', marginTop: '1rem' }}>
                        <thead>
                            <tr style={{ textAlign: 'left' }}><th>Name</th><th>Email</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td style={{ padding: '0.5rem 0' }}>{u.name}</td>
                                    <td>{u.email}</td>
                                    <td>
                                        <button className="btn btn-primary" onClick={() => verifyUser(u.id, 'verify')} style={{ marginRight: '0.5rem' }}>Verify</button>
                                        <button className="btn" style={{ background: '#ef4444', color: 'white' }} onClick={() => verifyUser(u.id, 'reject')}>Reject</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            <section className="card">
                <h3>Audit Logs</h3>
                <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '1rem' }}>
                    <table style={{ width: '100%', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: '#94a3b8' }}><th>Time</th><th>Actor</th><th>Action</th><th>Detail</th></tr>
                        </thead>
                        <tbody>
                            {logs.map(l => (
                                <tr key={l.id} style={{ borderBottom: '1px solid #334155' }}>
                                    <td style={{ padding: '0.5rem 0' }}>{new Date(l.created_at).toLocaleString()}</td>
                                    <td>{l.user?.email || 'System'}</td>
                                    <td>{l.action}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{JSON.stringify(l.detail_json)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
