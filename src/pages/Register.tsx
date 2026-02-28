import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { validateCPF, validateEmail, formatCPF, formatPhone } from '@/utils/validation';

export default function Register({ setUser }: { setUser: any }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient');
  const [psychologistId, setPsychologistId] = useState('');
  const [psychologists, setPsychologists] = useState<any[]>([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryRole = searchParams.get('role');

  useEffect(() => {
    if (queryRole) {
      setRole(queryRole);
    }
  }, [queryRole]);

  useEffect(() => {
    if (role === 'patient') {
      fetch('/api/psychologists')
        .then(res => res.json())
        .then(data => setPsychologists(data))
        .catch(console.error);
    }
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim().includes(' ')) {
      setError('Por favor, insira Nome e ao menos um Sobrenome.');
      return;
    }

    if (!validateEmail(email)) {
      setError('Por favor, insira um email válido.');
      return;
    }

    if (!validateCPF(cpf)) {
      setError('CPF inválido. Por favor, verifique os números.');
      return;
    }

    if (role === 'patient' && !psychologistId) {
      setError('Por favor, selecione um terapeuta.');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          email, 
          cpf: cpf.replace(/\D/g, ''),
          phone: phone.replace(/\D/g, ''),
          password, 
          role,
          psychologist_id: role === 'patient' ? Number(psychologistId) : null
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Auto login after register
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const loginData = await loginRes.json();
      
      localStorage.setItem('token', loginData.token);
      setUser(loginData.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="relative">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute left-4 top-4"
            onClick={() => navigate(queryRole ? `/login?role=${queryRole}` : '/login')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-center">Cadastro {queryRole === 'psychologist' ? 'Terapeuta' : queryRole === 'patient' ? 'Paciente' : ''}</CardTitle>
          <CardDescription className="text-center">Crie sua conta para começar.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <div className="space-y-2">
              <label htmlFor="name">Nome Completo</label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
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
            <div className="space-y-2">
              <label htmlFor="cpf">CPF</label>
              <Input
                id="cpf"
                type="text"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="phone">Celular</label>
              <Input
                id="phone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password">Senha</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {!queryRole && (
              <div className="space-y-2">
                <label htmlFor="role">Tipo de Conta</label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 focus-visible:ring-offset-2"
                >
                  <option value="patient">Paciente</option>
                  <option value="psychologist">Psicólogo(a)</option>
                </select>
              </div>
            )}
            {role === 'patient' && (
              <div className="space-y-2">
                <label htmlFor="psychologist">Selecione seu Terapeuta</label>
                <select
                  id="psychologist"
                  value={psychologistId}
                  onChange={(e) => setPsychologistId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 focus-visible:ring-offset-2"
                  required
                >
                  <option value="">Selecione...</option>
                  {psychologists.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button type="submit" className="w-full">Cadastrar</Button>
            <div className="text-sm text-center text-stone-500">
              Já tem uma conta? <Link to={`/login${queryRole ? `?role=${queryRole}` : ''}`} className="text-stone-900 underline">Entre aqui</Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
