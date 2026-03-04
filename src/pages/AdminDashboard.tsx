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
  UserCheck,
  AlertCircle,
  Clock,
  CreditCard,
  CheckCircle2
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
  const [sessionData, setSessionData] = useState<any[]>([]);
  const [patientCheckouts, setPatientCheckouts] = useState<any[]>([]);
  const [therapistCheckouts, setTherapistCheckouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [paymentStatus, setPaymentStatus] = useState('both');
  const [commissionStatus, setCommissionStatus] = useState('both');
  
  // Pagination states
  const [usersPage, setUsersPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [billingPage, setBillingPage] = useState(1);
  const [totalBilling, setTotalBilling] = useState(0);
  const [commissionsPage, setCommissionsPage] = useState(1);
  const [totalCommissions, setTotalCommissions] = useState(0);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [totalSessions, setTotalSessions] = useState(0);
  const [patientCheckoutsPage, setPatientCheckoutsPage] = useState(1);
  const [totalPatientCheckouts, setTotalPatientCheckouts] = useState(0);
  const [therapistCheckoutsPage, setTherapistCheckoutsPage] = useState(1);
  const [totalTherapistCheckouts, setTotalTherapistCheckouts] = useState(0);
  
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newCommission, setNewCommission] = useState(1.0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      return;
    }
    fetchData();
  }, [user, month, year, paymentStatus, commissionStatus, usersPage, billingPage, commissionsPage, sessionsPage, patientCheckoutsPage, therapistCheckoutsPage, search]);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const [usersRes, billingRes, commissionRes, sessionsRes, checkoutsRes, therapistCheckoutsRes] = await Promise.all([
        fetch(`/api/admin/users?page=${usersPage}&limit=50&search=${search}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/reports/billing?month=${month}&year=${year}&paymentStatus=${paymentStatus}&page=${billingPage}&limit=50`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/reports/commissions?month=${month}&year=${year}&page=${commissionsPage}&limit=50`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/reports/sessions?month=${month}&year=${year}&page=${sessionsPage}&limit=50`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/reports/patient-checkouts?page=${patientCheckoutsPage}&limit=50`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/reports/therapist-checkouts?page=${therapistCheckoutsPage}&limit=50`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const usersData = await usersRes.json();
      const billingReport = await billingRes.json();
      const commissionReport = await commissionRes.json();
      const sessionsReport = await sessionsRes.json();
      const checkoutsReport = await checkoutsRes.json();
      const therapistCheckoutsReport = await therapistCheckoutsRes.json();

      setUsers(usersData.users || []);
      setTotalUsers(usersData.total || 0);
      
      setBillingData(billingReport.billingData || []);
      setTherapistData(billingReport.therapistData || []);
      setTotalBilling(billingReport.totalBilling || 0);
      
      setCommissionData(commissionReport.commissions || []);
      setTotalCommissions(commissionReport.total || 0);
      
      setSessionData(sessionsReport.sessions || []);
      setTotalSessions(sessionsReport.total || 0);

      setPatientCheckouts(checkoutsReport.checkouts || []);
      setTotalPatientCheckouts(checkoutsReport.total || 0);

      setTherapistCheckouts(therapistCheckoutsReport.checkouts || []);
      setTotalTherapistCheckouts(therapistCheckoutsReport.total || 0);
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

  const handleMarkTherapistCheckoutAsPaid = async (checkoutId: number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/reports/therapist-checkouts/${checkoutId}/pay`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateSessionStatus = async (id: number, status: string, paymentStatus: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/appointments/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ status, payment_status: paymentStatus }),
      });

      if (res.ok) {
        setEditingSession(null);
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

  const filteredUsers = users;

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
          <TabsList className="grid w-full grid-cols-6 max-w-4xl mb-8 bg-stone-200 p-1">
            <TabsTrigger value="accounts" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Users className="h-4 w-4 mr-2" /> Contas
            </TabsTrigger>
            <TabsTrigger value="financial" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <DollarSign className="h-4 w-4 mr-2" /> Financeiro
            </TabsTrigger>
            <TabsTrigger value="revenue" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <TrendingUp className="h-4 w-4 mr-2" /> Faturamento
            </TabsTrigger>
            <TabsTrigger value="sessions" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Calendar className="h-4 w-4 mr-2" /> Sessões
            </TabsTrigger>
            <TabsTrigger value="checkouts" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <DollarSign className="h-4 w-4 mr-2" /> Pacientes
            </TabsTrigger>
            <TabsTrigger value="therapist-checkouts" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <CreditCard className="h-4 w-4 mr-2" /> Terapeutas
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
                      <th className="p-4 font-semibold text-stone-700">Taxa de Serviço (%)</th>
                      <th className="p-4 font-semibold text-stone-700">Status</th>
                      <th className="p-4 font-semibold text-stone-700 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-stone-400 italic">Nenhum usuário encontrado.</td>
                      </tr>
                    ) : (
                      filteredUsers.map(u => (
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
                            {u.blocked ? (
                              <div className="flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 cursor-default" title="Bloqueado por inadimplência">
                                <AlertCircle className="h-3 w-3" /> Bloqueado
                              </div>
                            ) : u.hasOverdueDebt ? (
                              <div className="flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 cursor-default" title="Possui débitos vencidos abaixo de R$ 50,00">
                                <Clock className="h-3 w-3" /> Débito Acumulado
                              </div>
                            ) : (
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
                            )}
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
                                          <label className="text-sm font-medium">Taxa de Serviço PsyQ (%)</label>
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-between p-4 bg-stone-50 border-t">
                <p className="text-xs text-stone-500">Total: {totalUsers} usuários</p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={usersPage === 1}
                    onClick={() => setUsersPage(p => p - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="flex items-center px-3 text-xs font-medium">Página {usersPage}</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={usersPage * 50 >= totalUsers}
                    onClick={() => setUsersPage(p => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
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
                {/* Pagination */}
                <div className="flex items-center justify-between p-4 bg-stone-50 border-t mt-4 rounded-b-lg">
                  <p className="text-xs text-stone-500">Total: {totalBilling} registros</p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={billingPage === 1}
                      onClick={() => setBillingPage(p => p - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="flex items-center px-3 text-xs font-medium">Página {billingPage}</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={billingPage * 50 >= totalBilling}
                      onClick={() => setBillingPage(p => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
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
                <h2 className="text-2xl font-bold text-stone-900">Faturamento da Plataforma (Taxas de Serviço)</h2>
                <p className="text-stone-500">Acompanhe as taxas de serviço devidas pelos terapeutas.</p>
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
                      <p className="text-stone-400 text-xs font-medium uppercase tracking-wider">Total em Taxas de Serviço (Mês)</p>
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
                      <p className="text-stone-500 text-xs font-medium uppercase tracking-wider">Taxas Recebidas</p>
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
                      <p className="text-stone-500 text-xs font-medium uppercase tracking-wider">Taxas Pendentes</p>
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
                <CardTitle className="text-lg">Relatório de Taxas de Serviço por Terapeuta</CardTitle>
                <CardDescription>Acompanhe o faturamento de cada profissional e a respectiva taxa de serviço da PsyQ.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200">
                        <th className="p-3 font-semibold text-stone-700 text-sm">Terapeuta</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm text-right">Faturamento (Pago)</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm text-center">Taxa (%)</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm text-right">Valor Taxa</th>
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
                          <td colSpan={3} className="p-3 text-right uppercase text-xs tracking-wider">Total de Taxas no Período</td>
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
                {/* Pagination */}
                <div className="flex items-center justify-between p-4 bg-stone-50 border-t mt-4 rounded-b-lg">
                  <p className="text-xs text-stone-500">Total: {totalCommissions} registros</p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={commissionsPage === 1}
                      onClick={() => setCommissionsPage(p => p - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="flex items-center px-3 text-xs font-medium">Página {commissionsPage}</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={commissionsPage * 50 >= totalCommissions}
                      onClick={() => setCommissionsPage(p => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions History Dashboard */}
          <TabsContent value="sessions" className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Histórico de Sessões</h2>
                <p className="text-stone-500">Visualize todas as sessões marcadas na plataforma.</p>
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
              </div>
            </div>

            <Card className="border-stone-200">
              <CardHeader>
                <CardTitle className="text-lg">Todas as Sessões</CardTitle>
                <CardDescription>Histórico completo de agendamentos, incluindo cancelados.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200">
                        <th className="p-3 font-semibold text-stone-700 text-sm">ID</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm">Terapeuta</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm">Paciente</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm">Data</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm">Hora</th>
                        <th className="p-3 font-semibold text-stone-700 text-sm text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionData.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-stone-400 italic">Nenhuma sessão encontrada.</td>
                        </tr>
                      ) : (
                        sessionData.map((item, idx) => (
                          <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                            <td className="p-3 text-xs font-mono text-stone-500">{item.formatted_id}</td>
                            <td className="p-3 text-sm text-stone-900 font-medium">{item.psychologist_name}</td>
                            <td className="p-3 text-sm text-stone-600">{item.patient_name}</td>
                            <td className="p-3 text-sm text-stone-600">{item.date.split('-').reverse().join('/')}</td>
                            <td className="p-3 text-sm text-stone-600">{item.start_time}</td>
                            <td className="p-3 text-sm text-center">
                              <Dialog open={editingSession?.id === item.id} onOpenChange={(open) => !open && setEditingSession(null)}>
                                <DialogTrigger asChild>
                                  <button 
                                    onClick={() => setEditingSession(item)}
                                    className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase transition-all hover:scale-105 cursor-pointer ${
                                      item.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                                      item.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 
                                      'bg-blue-100 text-blue-700'
                                    }`}
                                  >
                                    {item.status === 'cancelled' ? 'Cancelado' : 
                                     item.payment_status === 'paid' ? 'Pago' : 'Pendente'}
                                  </button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px]">
                                  <DialogHeader>
                                    <DialogTitle>Alterar Status da Sessão</DialogTitle>
                                    <DialogDescription>
                                      Selecione a nova situação para a sessão de {item.patient_name} com {item.psychologist_name}.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="grid gap-4 py-4">
                                    <Button 
                                      variant={item.payment_status === 'paid' && item.status === 'scheduled' ? 'default' : 'outline'}
                                      className="justify-start h-12"
                                      onClick={() => handleUpdateSessionStatus(item.id, 'scheduled', 'paid')}
                                    >
                                      <CheckCircle2 className="mr-2 h-5 w-5 text-emerald-500" />
                                      <div className="text-left">
                                        <div className="font-bold">Pago</div>
                                        <div className="text-xs opacity-70">Sessão realizada e paga</div>
                                      </div>
                                    </Button>
                                    <Button 
                                      variant={item.payment_status === 'pending' && item.status === 'scheduled' ? 'default' : 'outline'}
                                      className="justify-start h-12"
                                      onClick={() => handleUpdateSessionStatus(item.id, 'scheduled', 'pending')}
                                    >
                                      <Clock className="mr-2 h-5 w-5 text-blue-500" />
                                      <div className="text-left">
                                        <div className="font-bold">Pendente</div>
                                        <div className="text-xs opacity-70">Sessão agendada ou realizada, aguardando pagamento</div>
                                      </div>
                                    </Button>
                                    <Button 
                                      variant={item.status === 'cancelled' ? 'destructive' : 'outline'}
                                      className="justify-start h-12"
                                      onClick={() => handleUpdateSessionStatus(item.id, 'cancelled', 'pending')}
                                    >
                                      <UserX className="mr-2 h-5 w-5 text-red-500" />
                                      <div className="text-left">
                                        <div className="font-bold">Cancelado</div>
                                        <div className="text-xs opacity-70">Sessão cancelada</div>
                                      </div>
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between p-4 bg-stone-50 border-t mt-4 rounded-b-lg">
                  <p className="text-xs text-stone-500">Total: {totalSessions} sessões</p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={sessionsPage === 1}
                      onClick={() => setSessionsPage(p => p - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="flex items-center px-3 text-xs font-medium">Página {sessionsPage}</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={sessionsPage * 50 >= totalSessions}
                      onClick={() => setSessionsPage(p => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Patient Checkouts Dashboard */}
          <TabsContent value="checkouts" className="space-y-6">
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="border-b border-stone-100 bg-white">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl font-serif">Checkouts de Pacientes</CardTitle>
                    <CardDescription>Histórico de pagamentos informados pelos pacientes</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-stone-50 text-stone-500 font-medium">
                      <tr>
                        <th className="px-6 py-4">ID do Checkout</th>
                        <th className="px-6 py-4">Paciente</th>
                        <th className="px-6 py-4">Terapeuta</th>
                        <th className="px-6 py-4">Mês/Ano</th>
                        <th className="px-6 py-4">Valor</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Data do Checkout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {patientCheckouts.length > 0 ? (
                        patientCheckouts.map((checkout) => (
                          <tr key={checkout.id} className="hover:bg-stone-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs font-medium text-stone-900">{checkout.formattedId}</td>
                            <td className="px-6 py-4 font-medium text-stone-900">{checkout.patient_name}</td>
                            <td className="px-6 py-4 text-stone-600">{checkout.psychologist_name}</td>
                            <td className="px-6 py-4 text-stone-600">{`${checkout.month}/${checkout.year}`}</td>
                            <td className="px-6 py-4 font-medium text-emerald-600">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(checkout.amount)}
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">
                                {checkout.status === 'paid' ? 'Pago' : checkout.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-stone-500 text-xs">
                              {new Date(checkout.created_at).toLocaleDateString('pt-BR')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-stone-400 italic">
                            Nenhum checkout encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
                  <div className="text-xs text-stone-500">
                    Mostrando <strong>{patientCheckouts.length}</strong> de <strong>{totalPatientCheckouts}</strong> checkouts
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPatientCheckoutsPage(p => Math.max(1, p - 1))}
                      disabled={patientCheckoutsPage === 1}
                      className="h-8 text-xs"
                    >
                      Anterior
                    </Button>
                    <div className="flex items-center px-3 text-xs font-medium bg-white border border-stone-200 rounded-md">
                      Página {patientCheckoutsPage}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPatientCheckoutsPage(p => p + 1)}
                      disabled={patientCheckoutsPage * 50 >= totalPatientCheckouts}
                      className="h-8 text-xs"
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Therapist Checkouts Dashboard */}
          <TabsContent value="therapist-checkouts" className="space-y-6">
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="border-b border-stone-100 bg-white">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl font-serif">Checkouts de Terapeutas</CardTitle>
                    <CardDescription>Histórico de pagamentos de taxas de serviço pelos terapeutas</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-stone-50 text-stone-500 font-medium">
                      <tr>
                        <th className="px-6 py-4">ID do Checkout</th>
                        <th className="px-6 py-4">Terapeuta</th>
                        <th className="px-6 py-4">Mês/Ano</th>
                        <th className="px-6 py-4">Valor</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Data do Checkout</th>
                        <th className="px-6 py-4">ID AbacatePay</th>
                        <th className="px-6 py-4">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {therapistCheckouts.length > 0 ? (
                        therapistCheckouts.map((checkout) => {
                          const months = JSON.parse(checkout.months_json || '[]');
                          const monthsStr = months.map((m: any) => `${m.month}/${m.year}`).join(', ');
                          
                          return (
                            <tr key={checkout.id} className="hover:bg-stone-50 transition-colors">
                              <td className="px-6 py-4 font-mono text-xs font-medium text-stone-900">{checkout.formattedId}</td>
                              <td className="px-6 py-4 font-medium text-stone-900">{checkout.psychologist_name}</td>
                              <td className="px-6 py-4 text-stone-600 text-xs max-w-[200px] truncate" title={monthsStr}>{monthsStr}</td>
                              <td className="px-6 py-4 font-medium text-emerald-600">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(checkout.amount)}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                  checkout.status === 'PAID' 
                                    ? 'bg-emerald-100 text-emerald-700' 
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {checkout.status === 'PAID' ? 'Pago' : 'Pendente'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-stone-500 text-xs">
                                {new Date(checkout.created_at).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="px-6 py-4 font-mono text-[10px] text-stone-400">{checkout.charge_id}</td>
                              <td className="px-6 py-4">
                                {checkout.status === 'PENDING' && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="outline" className="h-8 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                                        Marcar como Pago
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Confirmar Pagamento Manual</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Deseja marcar o checkout {checkout.formattedId} como pago manualmente? 
                                          Esta ação irá atualizar o status do terapeuta e registrar o faturamento.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleMarkTherapistCheckoutAsPaid(checkout.id)} className="bg-emerald-600 hover:bg-emerald-700">
                                          Confirmar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-stone-400 italic">
                            Nenhum checkout encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
                  <div className="text-xs text-stone-500">
                    Mostrando <strong>{therapistCheckouts.length}</strong> de <strong>{totalTherapistCheckouts}</strong> checkouts
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTherapistCheckoutsPage(p => Math.max(1, p - 1))}
                      disabled={therapistCheckoutsPage === 1}
                      className="h-8 text-xs"
                    >
                      Anterior
                    </Button>
                    <div className="flex items-center px-3 text-xs font-medium bg-white border border-stone-200 rounded-md">
                      Página {therapistCheckoutsPage}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTherapistCheckoutsPage(p => p + 1)}
                      disabled={therapistCheckoutsPage * 50 >= totalTherapistCheckouts}
                      className="h-8 text-xs"
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
