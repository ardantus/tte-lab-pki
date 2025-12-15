'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', national_id_sim: '', password: ''
    })
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            if (res.ok) {
                alert('Registration successful! Please login.')
                router.push('/login')
            } else {
                const data = await res.json()
                alert(data.message)
            }
        } catch (err) {
            alert('Registration failed')
        }
    }

    return (
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
            <div className="glass" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                <h1 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Create Identity</h1>
                <form onSubmit={handleSubmit}>
                    <input placeholder="Full Name" className="input" onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    <input placeholder="Email" type="email" className="input" onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    <input placeholder="Phone" className="input" onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                    <input placeholder="National ID / SIM" className="input" onChange={e => setFormData({ ...formData, national_id_sim: e.target.value })} />
                    <input placeholder="Password" type="password" className="input" onChange={e => setFormData({ ...formData, password: e.target.value })} />
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Register</button>
                </form>
                <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
                    Have an account? <Link href="/login" style={{ color: 'var(--primary)' }}>Login</Link>
                </div>
            </div>
        </div>
    )
}
