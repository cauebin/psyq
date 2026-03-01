import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';

export default function Login({ setUser }: { setUser: any }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (isForgotPassword) {
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        setSuccessMessage(data.message);
      } catch (err: any) {
        setError('Erro ao solicitar recuperação de senha.');
      }
      return;
    }

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

      // Verify role if specified
      if (role && data.user.role !== role) {
        throw new Error(`Esta conta não é de ${role === 'psychologist' ? 'terapeuta' : 'paciente'}.`);
      }

      localStorage.setItem('token', data.token);
      setUser(data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4">
      <Card className="w-full max-w-md relative">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute left-4 top-4"
          onClick={() => {
            if (isForgotPassword) {
              setIsForgotPassword(false);
            } else {
              navigate('/');
            }
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <CardHeader className="pt-14">
          <CardTitle>
            {isForgotPassword ? 'Recuperar Senha' : `Login ${role === 'psychologist' ? 'Terapeuta' : role === 'patient' ? 'Paciente' : ''}`}
          </CardTitle>
          <CardDescription>
            {isForgotPassword 
              ? 'Digite seu email para receber uma nova senha.' 
              : 'Entre na sua conta para continuar.'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <div className="text-red-500 text-sm">{error}</div>}
            {successMessage && <div className="text-green-600 text-sm">{successMessage}</div>}
            
            <div className="space-y-2">
              <label htmlFor="email">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            {!isForgotPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password">Senha</label>
                  <button 
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-xs text-stone-500 hover:text-stone-900 underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button type="submit" className="w-full">
              {isForgotPassword ? 'Enviar Nova Senha' : 'Entrar'}
            </Button>
            
            {isForgotPassword ? (
              <button 
                type="button"
                onClick={() => setIsForgotPassword(false)}
                className="text-sm text-stone-500 hover:text-stone-900 underline"
              >
                Voltar para Login
              </button>
            ) : (
              <div className="text-sm text-center text-stone-500">
                Não tem uma conta? <Link to={`/register${role ? `?role=${role}` : ''}`} className="text-stone-900 underline">Cadastre-se</Link>
              </div>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
