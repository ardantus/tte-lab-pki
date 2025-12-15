'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })
            const data = await res.json()
            if (res.ok) {
                localStorage.setItem('token', data.token)
                // Decode token to find role? Simplified: just go to dashboard, dashboard checks role logic or just renders.
                router.push('/dashboard')
            } else {
                alert(data.message)
            }
        } catch (err) {
            alert('Login failed')
        }
    }

    return (
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
            <div className="glass" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                <h1 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>VendorSign Login</h1>
                <form onSubmit={handleLogin}>
                    <input
                        type="email"
                        placeholder="Email"
                        className="input"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        className="input"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Login</button>
                </form>
                <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
                    Don't have an account? <Link href="/register" style={{ color: 'var(--primary)' }}>Register</Link>
                </div>
            </div>
        </div>
    )
}
