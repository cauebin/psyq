import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  DollarSign, 
  Trash2, 
  Edit, 
  Search, 
  LogOut, 
  ShieldCheck,
  TrendingUp,
  Calendar,
  UserX,
  UserCheck
} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCPF, formatPhone } from '@/utils/validation';

export default function AdminDashboard({ user, setUser }: { user: any, setUser: any }) {
  const [users, setUsers] = useState<any[]>([]);
  const [billingData, setBillingData] = useState<any[]>([]);
  const [therapistData, setTherapistData] = useState<any[]>([]);
  const [commissionData, setCommissionData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [paymentStatus, setPaymentStatus] = useState('both');
  const [commissionStatus, setCommissionStatus] = useState('both');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newCommission, setNewCommission] = useState(1.0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      return;
    }
    fetchData();
  }, [user, month, year, paymentStatus, commissionStatus]);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const [usersRes, billingRes, commissionRes] = await Promise.all([
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/reports/billing?month=${month}&year=${year}&paymentStatus=${paymentStatus}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/reports/commissions?month=${month}&year=${year}&status=${commissionStatus}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const usersData = await usersRes.json();
      const billingReport = await billingRes.json();
      const commissionReport = await commissionRes.json();

      setUsers(usersData);
      setBillingData(billingReport.billingData || []);
      setTherapistData(billingReport.therapistData || []);
      setCommissionData(commissionReport || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ email: newEmail, password: newPassword }),
      });

      if (res.ok) {
        // If it's a psychologist, also update commission
        if (editingUser.role === 'psychologist') {
          await fetch(`/api/admin/users/${editingUser.id}/commission`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify({ commission_percentage: newCommission }),
          });
        }

        setEditingUser(null);
        setNewEmail('');
        setNewPassword('');
        setNewCommission(1.0);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickUpdateCommission = async (userId: number, value: number) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/admin/users/${userId}/commission`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ commission_percentage: value }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatus = async (userId: number, currentStatus: number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ deleted: !currentStatus }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/');
  };

  const filteredUsers = users.filter(u => 
    u?.role !== 'admin' && (
      u?.name?.toLowerCase().includes(search.toLowerCase()) || 
      u?.email?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const globalTotal = therapistData.reduce((acc, curr) => acc + curr.total_value, 0);

  const roleLabels: any = {
    admin: 'Administrador',
    psychologist: 'Terapeuta',
    patient: 'Paciente'
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-stone-900 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-emerald-400" />
            <div>
              <h1 className="text-xl font-serif font-bold tracking-tight">PsyQ Admin</h1>
              <p className="text-xs text-stone-400">Painel de Controle Central</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-stone-400">Superusuário</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-stone-400 hover:text-white hover:bg-stone-800">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        <Tabs defaultValue="accounts" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-xl mb-8 bg-stone-200 p-1">
            <TabsTrigger value="accounts" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Users className="h-4 w-4 mr-2" /> Contas
            </TabsTrigger>
            <TabsTrigger value="financial" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <DollarSign className="h-4 w-4 mr-2" /> Financeiro
            </TabsTrigger>
            <TabsTrigger value="revenue" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <TrendingUp className="h-4 w-4 mr-2" /> Faturamento
            </TabsTrigger>
          </TabsList>

          {/* Accounts Dashboard */}
          <TabsContent value="accounts" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Gerenciamento de Contas</h2>
                <p className="text-stone-500">Visualize e gerencie todos os usuários da plataforma.</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 h-4 w-4" />
                <Input 
                  placeholder="Buscar por nome ou email..." 
                  className="pl-10 border-stone-300"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <Card className="border-stone-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-200">
                      <th className="p-4 font-semibold text-stone-700">Nome</th>
                      <th className="p-4 font-semibold text-stone-700">Tipo</th>
                      <th className="p-4 font-semibold text-stone-700">CPF</th>
                      <th className="p-4 font-semibold text-stone-700">Celular</th>
                      <th className="p-4 font-semibold text-stone-700">Login (Email)</th>
                      <th className="p-4 font-semibold text-stone-700">Comissão (%)</th>
                      <th className="p-4 font-semibold text-stone-700">Status</th>
                      <th className="p-4 font-semibold text-stone-700 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                        <td className="p-4 font-medium text-stone-900">{u.name}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            u.role === 'psychologist' ? 'bg-blue-100 text-blue-700' :
                            'bg-stone-100 text-stone-700'
                          }`}>
                            {roleLabels[u?.role]}
                          </span>
                        </td>
                        <td className="p-4 text-stone-600 font-mono text-xs">{u.cpf ? formatCPF(u.cpf) : '-'}</td>
                        <td className="p-4 text-stone-600 font-mono text-xs">{u.phone ? formatPhone(u.phone) : '-'}</td>
                        <td className="p-4 text-stone-600">{u.email}</td>
                        <td className="p-4">
                          {u?.role === 'psychologist' ? (
                            <div className="flex items-center gap-2">
                              <Input 
                                type="number" 
                                className="w-20 h-8 text-sm" 
                                defaultValue={u.commission_percentage || 1.0}
                                onBlur={(e) => handleQuickUpdateCommission(u.id, parseFloat(e.target.value))}
                              />
                              <span className="text-stone-400 text-xs">%</span>
                            </div>
                          ) : (
                            <span className="text-stone-300">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <button 
                            onClick={() => u?.role !== 'admin' && handleToggleStatus(u.id, u.deleted)}
                            disabled={u?.role === 'admin'}
                            className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                              u.deleted 
                                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            } ${u?.role === 'admin' ? 'cursor-default' : 'cursor-pointer'}`}
                            title={u?.role === 'admin' ? '' : u.deleted ? 'Ativar conta' : 'Desativar conta'}
                          >
                            {u.deleted ? (
                              <><UserX className="h-3 w-3" /> Inativa</>
                            ) : (
                              <><UserCheck className="h-3 w-3" /> Ativa</>
                            )}
                          </button>
                        </td>
                        <td className="p-4 text-center space-x-2">
                          {u?.role !== 'admin' && (
                            <>
                              <Dialog open={editingUser?.id === u.id} onOpenChange={(open) => {
                                if (!open) setEditingUser(null);
                                else {
                                  setEditingUser(u);
                                  setNewEmail(u.email);
                                  setNewCommission(u.commission_percentage || 1.0);
                                }
                              }}>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-stone-400 hover:text-stone-900">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Editar Conta: {u.name}</DialogTitle>
                                    <DialogDescription>
                                      Altere o login ou defina uma nova senha para este usuário.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Novo Login (Email)</label>
                                      <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                                    </div>
                                    {u?.role === 'psychologist' && (
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">Comissão PsyQ (%)</label>
                                        <Input type="number" step="0.1" value={newCommission} onChange={(e) => setNewCommission(parseFloat(e.target.value))} />
                                      </div>
                                    )}
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Nova Senha</label>
                                      <Input type="password" placeholder="Deixe em branco para não alterar" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
                                    <Button onClick={handleUpdateUser} className="bg-stone-900">Salvar Alterações</Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-stone-400 hover:text-red-600">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Encerrar conta de {u.name}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação irá desativar a conta e cancelar todos os agendamentos futuros. O email será liberado para novo uso.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(u.id)} className="bg-red-600">Encerrar Conta</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Financial Dashboard */}
          <TabsContent value="financial" className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Relatórios Financeiros</h2>
                <p className="text-stone-500">Acompanhe o faturamento e desempenho da plataforma.</p>
              </div>
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-stone-200 shadow-sm">
                <Calendar className="h-4 w-4 text-stone-400 ml-2" />
                <select 
                  className="bg-transparent text-sm font-medium focus:outline-none"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  <option value={1}>Janeiro</option>
                  <option value={2}>Fevereiro</option>
                  <option value={3}>Março</option>
                  <option value={4}>Abril</option>
                  <option value={5}>Maio</option>
                  <option value={6}>Junho</option>
                  <option value={7}>Julho</option>
                  <option value={8}>Agosto</option>
                  <option value={9}>Setembro</option>
                  <option value={10}>Outubro</option>
                  <option value={11}>Novembro</option>
                  <option value={12}>Dezembro</option>
                </select>
                <select 
                  className="bg-transparent text-sm font-medium focus:outline-none border-l pl-2"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                </select>
                <select 
                  className="bg-transparent text-sm font-medium focus:outline-none border-l pl-2"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                >
                  <option value="both">Todos</option>
                  <option value="paid">Pago</option>
                  <option value="pending">Pendente</option>
                </select>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-stone-900 text-white border-none shadow-lg">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-stone-400 text-xs font-medium uppercase tracking-wider">
                        {paymentStatus === 'paid' ? 'Faturamento Global' : 
                         paymentStatus === 'pending' ? 'Valor Pendente Global' : 
                         'Valor Total (Pago + Pendente)'}
                      </p>
                      <h3 className="text-3xl font-bold mt-1">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(globalTotal)}
                      </h3>
                    </div>
                    <div className="p-2 bg-stone-800 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-stone-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-stone-500 text-xs font-medium uppercase tracking-wider">
                        {paymentStatus === 'paid' ? 'Total de Sessões Pagas' : 
                         paymentStatus === 'pending' ? 'Total de Sessões Pendentes' : 
                         'Total de Sessões (Pagas + Pendentes)'}
                      </p>
                      <h3 className="text-3xl font-bold mt-1 text-stone-900">
                        {therapistData.reduce((acc, curr) => acc + curr.session_count, 0)}
                      </h3>
                    </div>
                    <div className="p-2 bg-stone-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-stone-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-stone-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-stone-500 text-xs font-medium uppercase tracking-wider">Terapeutas Ativos</p>
                      <h3 className="text-3xl font-bold mt-1 text-stone-900">
                        {therapistData.length}
                      </h3>
                    </div>
                    <div className="p-2 bg-stone-100 rounded-lg">
                      <Users className="h-5 w-5 text-stone-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Report 1: Detailed Billing */}
            <Card className="border-stone-200">
              <CardHeader>
                <CardTitle className="text-lg">
                  {paymentStatus === 'paid' ? 'Faturamento por Paciente/Terapeuta' : 
                   paymentStatus === 'pending' ? 'Valores Pendentes por Paciente/Terapeuta' : 
                   'Faturamento Total por Paciente/Terapeuta'}
                </CardTitle>
                <CardDescription>
                  {paymentStatus === 'paid' ? 'Detalhamento de todas as sessões pagas no período selecionado.' : 
                   paymentStatus === 'pending' ? 'Detalhamento de todas as sessões pendentes no período selecionado.' : 
                   'Detalhamento de todas as sessões (pagas e pendentes) no período selecionado.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200">
                        <th className="p-3 font-semibold text-stone-700 text-sm">Paciente</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm">Terapeuta</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm text-center">Qtd. Terapias</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm text-right">Valor Unitário</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingData.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-stone-400 italic">Nenhum dado encontrado para este período.</td>
                        </tr>
                      ) : (
                        billingData.map((item, idx) => (
                          <tr key={idx} className="border-b border-stone-100">
                            <td className="p-3 text-sm text-stone-900">{item.patient_name}</td>
                            <td className="p-3 text-sm text-stone-600">{item.psychologist_name}</td>
                            <td className="p-3 text-sm text-center">{item.session_count}</td>
                            <td className="p-3 text-sm text-right">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.unit_price)}
                            </td>
                            <td className="p-3 text-sm text-right font-medium">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total_value)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {billingData.length > 0 && (
                      <tfoot>
                        <tr className="bg-stone-50 font-bold">
                          <td colSpan={4} className="p-3 text-right text-stone-900 uppercase text-xs tracking-wider">Total Global</td>
                          <td className="p-3 text-right text-stone-900">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(globalTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Report 2: Therapist Summary */}
            <Card className="border-stone-200">
              <CardHeader>
                <CardTitle className="text-lg">
                  {paymentStatus === 'paid' ? 'Consolidado por Terapeuta' : 
                   paymentStatus === 'pending' ? 'Pendências por Terapeuta' : 
                   'Consolidado Total por Terapeuta'}
                </CardTitle>
                <CardDescription>
                  {paymentStatus === 'paid' ? 'Resumo de produtividade e faturamento por profissional.' : 
                   paymentStatus === 'pending' ? 'Resumo de sessões pendentes por profissional.' : 
                   'Resumo de produtividade e faturamento total (pago + pendente) por profissional.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200">
                        <th className="p-3 font-semibold text-stone-700 text-sm">Terapeuta</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm text-center">Qtd. Terapias</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm text-right">Valor Unitário Médio</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {therapistData.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-stone-400 italic">Nenhum dado encontrado para este período.</td>
                        </tr>
                      ) : (
                        therapistData.map((item, idx) => (
                          <tr key={idx} className="border-b border-stone-100">
                            <td className="p-3 text-sm text-stone-900 font-medium">{item.psychologist_name}</td>
                            <td className="p-3 text-sm text-center">{item.session_count}</td>
                            <td className="p-3 text-sm text-right">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.avg_price)}
                            </td>
                            <td className="p-3 text-sm text-right font-bold text-stone-900">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total_value)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {therapistData.length > 0 && (
                      <tfoot>
                        <tr className="bg-stone-900 text-white font-bold">
                          <td colSpan={3} className="p-3 text-right uppercase text-xs tracking-wider">Total Global da Plataforma</td>
                          <td className="p-3 text-right">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(globalTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue (Commissions) Dashboard */}
          <TabsContent value="revenue" className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Faturamento da Plataforma (Comissões)</h2>
                <p className="text-stone-500">Acompanhe as comissões devidas pelos terapeutas.</p>
              </div>
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-stone-200 shadow-sm">
                <Calendar className="h-4 w-4 text-stone-400 ml-2" />
                <select 
                  className="bg-transparent text-sm font-medium focus:outline-none"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  <option value={1}>Janeiro</option>
                  <option value={2}>Fevereiro</option>
                  <option value={3}>Março</option>
                  <option value={4}>Abril</option>
                  <option value={5}>Maio</option>
                  <option value={6}>Junho</option>
                  <option value={7}>Julho</option>
                  <option value={8}>Agosto</option>
                  <option value={9}>Setembro</option>
                  <option value={10}>Outubro</option>
                  <option value={11}>Novembro</option>
                  <option value={12}>Dezembro</option>
                </select>
                <select 
                  className="bg-transparent text-sm font-medium focus:outline-none border-l pl-2"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                </select>
                <select 
                  className="bg-transparent text-sm font-medium focus:outline-none border-l pl-2"
                  value={commissionStatus}
                  onChange={(e) => setCommissionStatus(e.target.value)}
                >
                  <option value="both">Todos</option>
                  <option value="paid">Pago</option>
                  <option value="pending">Pendente</option>
                </select>
              </div>
            </div>

            {/* Commission Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-stone-900 text-white border-none shadow-lg">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-stone-400 text-xs font-medium uppercase tracking-wider">Total em Comissões (Mês)</p>
                      <h3 className="text-3xl font-bold mt-1">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          commissionData.reduce((acc, curr) => acc + curr.commission_amount, 0)
                        )}
                      </h3>
                    </div>
                    <div className="p-2 bg-stone-800 rounded-lg">
                      <DollarSign className="h-5 w-5 text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-stone-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-stone-500 text-xs font-medium uppercase tracking-wider">Comissões Recebidas</p>
                      <h3 className="text-3xl font-bold mt-1 text-emerald-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          commissionData.filter(c => c.status === 'paid').reduce((acc, curr) => acc + curr.paid_amount, 0)
                        )}
                      </h3>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-lg">
                      <UserCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-stone-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-stone-500 text-xs font-medium uppercase tracking-wider">Comissões Pendentes</p>
                      <h3 className="text-3xl font-bold mt-1 text-red-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          commissionData.filter(c => c.status === 'pending').reduce((acc, curr) => acc + curr.commission_amount, 0)
                        )}
                      </h3>
                    </div>
                    <div className="p-2 bg-red-50 rounded-lg">
                      <UserX className="h-5 w-5 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-stone-200">
              <CardHeader>
                <CardTitle className="text-lg">Relatório de Comissões por Terapeuta</CardTitle>
                <CardDescription>Acompanhe o faturamento de cada profissional e a respectiva comissão da PsyQ.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200">
                        <th className="p-3 font-semibold text-stone-700 text-sm">Terapeuta</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm text-right">Faturamento (Pago)</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm text-center">Comissão (%)</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm text-right">Valor Comissão</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm text-center">Status</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm">Data Pagamento</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm">ID Pagamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissionData.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-stone-400 italic">Nenhum dado encontrado para este período.</td>
                        </tr>
                      ) : (
                        commissionData.map((item, idx) => (
                          <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                            <td className="p-3 text-sm text-stone-900 font-medium">{item.psychologist_name}</td>
                            <td className="p-3 text-sm text-right">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total_revenue)}
                            </td>
                            <td className="p-3 text-sm text-center text-stone-600">{item.commission_percentage}%</td>
                            <td className="p-3 text-sm text-right font-bold text-stone-900">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.commission_amount)}
                            </td>
                            <td className="p-3 text-sm text-center">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                item.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {item.status === 'paid' ? 'Pago' : 'Pendente'}
                              </span>
                            </td>
                            <td className="p-3 text-sm text-stone-500">
                              {item.payment_date ? item.payment_date.split('-').reverse().join('/') : '-'}
                            </td>
                            <td className="p-3 text-xs text-stone-400 font-mono">
                              {item.charge_id || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {commissionData.length > 0 && (
                      <tfoot>
                        <tr className="bg-stone-900 text-white font-bold">
                          <td colSpan={3} className="p-3 text-right uppercase text-xs tracking-wider">Total de Comissões no Período</td>
                          <td className="p-3 text-right">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                              commissionData.reduce((acc, curr) => acc + curr.commission_amount, 0)
                            )}
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
