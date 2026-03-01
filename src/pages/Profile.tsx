import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { User, Phone, Lock, HeartHandshake, ArrowLeft, FileText, Trash2, Eye, EyeOff } from 'lucide-react';
import { validateCPF, formatCPF, formatPhone, validateCNPJ, formatCNPJ } from '@/utils/validation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Profile({ user, setUser }: { user: any, setUser: any }) {
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(formatPhone(user.phone || ''));
  const [cpf, setCpf] = useState(formatCPF(user.cpf || ''));
  const [cnpj, setCnpj] = useState(formatCNPJ(user.cnpj || ''));
  const [crp, setCrp] = useState(user.crp || '');
  const [pixKeyType, setPixKeyType] = useState(user.pix_key_type || 'email');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [psychologists, setPsychologists] = useState<any[]>([]);
  const [selectedPsychologist, setSelectedPsychologist] = useState(user.psychologist_id || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (user.role === 'patient') {
      fetch('/api/psychologists')
        .then(res => res.json())
        .then(data => setPsychologists(data))
        .catch(console.error);
    }
  }, [user.role]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!name.trim().includes(' ')) {
      setError('Por favor, insira Nome e Sobrenome.');
      return;
    }

    if (password && password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    if (user.role === 'psychologist' && crp) {
      const crpRegex = /^\d{2}\/\d{1,6}$/;
      if (!crpRegex.test(crp)) {
        setError('O CRP deve estar no formato XX/XXXXX (ex: 06/12345).');
        return;
      }
    }

    if (cpf && !validateCPF(cpf)) {
      setError('CPF inválido. Por favor, verifique os números.');
      return;
    }

    if (cnpj && !validateCNPJ(cnpj)) {
      setError('CNPJ inválido. Por favor, verifique os números.');
      return;
    }

    const cpfClean = cpf.replace(/\D/g, '');
    const cnpjClean = cnpj.replace(/\D/g, '');
    const phoneClean = phone.replace(/\D/g, '');
    const token = localStorage.getItem('token');
    try {
      const body: any = { name, phone: phoneClean, cpf: cpfClean, cnpj: cnpjClean };
      if (password) body.password = password;
      if (user.role === 'patient' && selectedPsychologist && selectedPsychologist !== user.psychologist_id) {
        body.psychologist_id = selectedPsychologist;
      }
      if (user.role === 'psychologist') {
        body.crp = crp;
        body.pix_key_type = pixKeyType;
      }

      const res = await fetch('/api/patients/me', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Erro ao atualizar perfil');

      setMessage('Perfil atualizado com sucesso!');
      if (password) setPassword('');
      if (confirmPassword) setConfirmPassword('');
      
      // Refresh user data
      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const meData = await meRes.json();
      setUser(meData);

    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteAccount = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/patients/me', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Erro ao encerrar conta');

      localStorage.removeItem('token');
      setUser(null);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-3xl font-bold text-stone-900">Meu Perfil</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Dados Pessoais</CardTitle>
          <CardDescription>Atualize suas informações de contato e segurança.</CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdateProfile}>
          <CardContent className="space-y-4">
            {message && <div className="text-green-600 text-sm">{message}</div>}
            {error && <div className="text-red-600 text-sm">{error}</div>}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 h-4 w-4" />
                <Input 
                  className="pl-10" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Nome e Sobrenome"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input value={user.email} disabled className="bg-stone-100" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">CPF</label>
              <Input 
                placeholder="000.000.000-00" 
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Celular (com DDD)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 h-4 w-4" />
                <Input 
                  className="pl-10" 
                  placeholder="(11) 99999-9999" 
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                />
              </div>
            </div>

            {user.role === 'psychologist' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">CRP (Conselho Regional de Psicologia)</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 h-4 w-4" />
                    <Input 
                      className="pl-10" 
                      placeholder="06/12345" 
                      value={crp}
                      onChange={(e) => setCrp(e.target.value)}
                      maxLength={9}
                    />
                  </div>
                  <p className="text-xs text-stone-500">Formato: XX/XXXXX (ex: 06/12345)</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">CNPJ (Opcional)</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 h-4 w-4" />
                    <Input 
                      className="pl-10" 
                      placeholder="00.000.000/0000-00" 
                      value={cnpj}
                      onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                    />
                  </div>
                  <p className="text-xs text-stone-500">Se preenchido, você poderá usar o CNPJ como chave PIX.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Chave PIX Preferencial</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                    value={pixKeyType}
                    onChange={(e) => setPixKeyType(e.target.value)}
                  >
                    <option value="email">E-mail ({user.email})</option>
                    <option value="cpf">CPF ({cpf || 'Não informado'})</option>
                    <option value="phone">Celular ({phone || 'Não informado'})</option>
                    {cnpj && <option value="cnpj">CNPJ ({cnpj})</option>}
                  </select>
                  <p className="text-xs text-stone-500">Esta chave será usada para gerar o QR Code de pagamento para seus pacientes.</p>
                </div>
              </>
            )}

            <div className="border-t pt-4 mt-4">
              <h3 className="text-lg font-medium mb-4">Alterar Senha</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nova Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 h-4 w-4" />
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      className="pl-10 pr-10" 
                      placeholder="Deixe em branco para manter a atual" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirmar Nova Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 h-4 w-4" />
                    <Input 
                      type={showConfirmPassword ? "text" : "password"} 
                      className="pl-10 pr-10" 
                      placeholder="Confirme a nova senha" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {user.role === 'patient' && (
              <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-medium mb-4">Meu Terapeuta</h3>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Terapeuta Atual</label>
                  <div className="relative">
                    <HeartHandshake className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 h-4 w-4" />
                    <select 
                      className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 pl-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 focus-visible:ring-offset-2"
                      value={selectedPsychologist}
                      onChange={(e) => setSelectedPsychologist(Number(e.target.value))}
                    >
                      <option value="" disabled>Selecione um terapeuta</option>
                      {psychologists.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-stone-500">
                    Ao mudar de terapeuta, você precisará aguardar o aceite do novo profissional para acessar o painel.
                  </p>
                </div>
              </div>
            )}

          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="submit">Salvar Alterações</Button>
            
            {user.role === 'patient' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" type="button">
                    <Trash2 className="mr-2 h-4 w-4" /> Encerrar Conta
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação é irreversível. Sua conta será encerrada e todos os agendamentos futuros serão cancelados. 
                      Seus dados históricos (sessões passadas) serão mantidos para registro do terapeuta.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700">
                      Sim, encerrar minha conta
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
