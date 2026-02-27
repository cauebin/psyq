import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, ArrowLeft } from 'lucide-react';

export default function AdminLogin({ setUser }: { setUser: any }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.user.role !== 'admin') {
        throw new Error('Acesso restrito a administradores.');
      }

      localStorage.setItem('token', data.token);
      setUser(data.user);
      navigate('/admin-dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-100 p-4">
      <div className="w-full max-w-md mb-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')} 
          className="text-stone-600 hover:text-stone-900 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o site
        </Button>
      </div>
      <Card className="w-full max-w-md shadow-xl border-stone-200">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-stone-900 rounded-full">
              <Lock className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center font-serif">Acesso Administrativo</CardTitle>
          <CardDescription className="text-center">
            Entre com suas credenciais de administrador PsyQ.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Login</label>
              <Input
                id="email"
                type="email"
                placeholder="admin@psyq.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-stone-300 focus:ring-stone-900"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" title="Senha" className="text-sm font-medium">Senha</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-stone-300 focus:ring-stone-900"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full bg-stone-900 hover:bg-stone-800 text-white" disabled={loading}>
              {loading ? 'Autenticando...' : 'Entrar no Painel'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
