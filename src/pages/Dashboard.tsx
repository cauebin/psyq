import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isSameMonth, parseISO, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, DollarSign, Users, Clock, Settings, X, Check, Link as LinkIcon, QrCode, Copy, CheckCircle2, Loader2, CreditCard, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCPF, formatPhone } from '@/utils/validation';

export default function Dashboard({ user }: { user: any }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ session_duration: 90, work_on_holidays: 0 });
  const [holidays, setHolidays] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState('calendar');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [editingPatientId, setEditingPatientId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editDate, setEditDate] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<number | null>(null);
  const [isAllDayAbsence, setIsAllDayAbsence] = useState(true);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [pendingPatients, setPendingPatients] = useState<any[]>([]);

  // Booking State
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('weekly');
  const [selectedPatientForBooking, setSelectedPatientForBooking] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [receiveInvite, setReceiveInvite] = useState(false);

  // Platform Checkout State
  const [unpaidPlatformMonths, setUnpaidPlatformMonths] = useState<any[]>([]);
  const [selectedPlatformMonths, setSelectedPlatformMonths] = useState<string[]>([]);
  const [commissionRate, setCommissionRate] = useState(1.0);
  const [platformPaymentStep, setPlatformPaymentStep] = useState<'selection' | 'pix' | 'success' | 'failure'>('selection');
  const [platformPaymentHistory, setPlatformPaymentHistory] = useState<any[]>([]);
  const [isProcessingPlatformPayment, setIsProcessingPlatformPayment] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);

  useEffect(() => {
    let interval: any;
    if (platformPaymentStep === 'pix' && paymentData?.id) {
      interval = setInterval(async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`/api/checkout/status/${paymentData.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.status === 'PAID') {
            setPlatformPaymentStep('success');
            fetchData();
            clearInterval(interval);
          } else if (data.status === 'EXPIRED' || data.status === 'CANCELLED' || data.status === 'REFUNDED') {
            setPlatformPaymentStep('failure');
            clearInterval(interval);
          }
        } catch (e: any) {
          // Only log if it's not a network error (which happens during server restarts)
          if (e.name !== 'TypeError' || e.message !== 'Failed to fetch') {
            console.error('Polling error:', e);
          }
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [platformPaymentStep, paymentData]);

  useEffect(() => {
    fetchData();
  }, [currentDate, reportMonth]);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch Appointments
    const appRes = await fetch('/api/appointments', { headers });
    const appData = await appRes.json();
    setAppointments(appData.filter((a: any) => a.status !== 'cancelled'));

    // Fetch Patients
    const patRes = await fetch('/api/patients', { headers });
    const patData = await patRes.json();
    setPatients(patData);

    // Fetch Pending Patients
    const pendRes = await fetch('/api/patients/pending', { headers });
    const pendData = await pendRes.json();
    setPendingPatients(Array.isArray(pendData) ? pendData : []);

    // Fetch Availability
    const availRes = await fetch('/api/availability', { headers });
    const availData = await availRes.json();
    setAvailability(availData);

    // Fetch Holidays
    const holRes = await fetch('/api/holidays', { headers });
    const holData = await holRes.json();
    setHolidays(holData);

    // Fetch Absences
    const absRes = await fetch('/api/absences', { headers });
    const absData = await absRes.json();
    setAbsences(absData);

    // Fetch Reports
    const [rYear, rMonth] = reportMonth.split('-');
    const repRes = await fetch(`/api/reports?month=${rMonth}&year=${rYear}`, { headers });
    const repData = await repRes.json();
    setReports(Array.isArray(repData) ? repData : []);

    // Fetch Settings
    const setRes = await fetch('/api/settings', { headers });
    const setData = await setRes.json();
    if (setData) setSettings(setData);

    // Fetch Unpaid Platform Months
    const platRes = await fetch('/api/therapist/platform-checkout/unpaid', { headers });
    const platData = await platRes.json();
    
    const sortedUnpaid = (platData.unpaidMonths || []).sort((a: any, b: any) => {
      if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
      return parseInt(a.month) - parseInt(b.month);
    });
    
    setUnpaidPlatformMonths(sortedUnpaid);
    setCommissionRate(platData.commission_rate || 1.0);
    setPlatformPaymentHistory(platData.history || []);
  };

  const handleTogglePlatformMonth = (id: string) => {
    setSelectedPlatformMonths(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const totalPlatformToPay = unpaidPlatformMonths
    .filter(m => selectedPlatformMonths.includes(`${m.month}-${m.year}`))
    .reduce((acc, curr) => acc + curr.remaining_amount, 0);

  const handleCreatePayment = async () => {
    setIsProcessingPlatformPayment(true);
    const token = localStorage.getItem('token');
    
    try {
      const monthsToPay = unpaidPlatformMonths
        .filter(m => selectedPlatformMonths.includes(`${m.month}-${m.year}`))
        .map(m => ({
          month: parseInt(m.month),
          year: parseInt(m.year),
          amount: m.remaining_amount,
          revenue: m.remaining_revenue
        }));

      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ months: monthsToPay })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar pagamento');
      }

      const data = await res.json();
      setPaymentData(data);
      setPlatformPaymentStep('pix');
    } catch (err: any) {
      console.error('Error creating payment:', err);
      alert(`Erro: ${err.message}`);
    } finally {
      setIsProcessingPlatformPayment(false);
    }
  };

  const handleAcceptPatient = async (id: number) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/patients/${id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchData();
  };

  const getMeetLink = (link: string) => {
    if (!link) return '#';
    if (link.startsWith('http://') || link.startsWith('https://')) return link;
    return `https://${link}`;
  };

  const handleUpdatePatient = async (patientId: number, field: string, value: any) => {
    const token = localStorage.getItem('token');
    const body: any = { [field]: value };

    await fetch(`/api/patients/${patientId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(body),
    });
    fetchData();
  };

  const handleUpdateSettings = async (e: any) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(settings),
    });
    alert('Configurações salvas!');
  };

  const handleBookAppointment = async () => {
    if (!selectedDate || !selectedTime || !selectedPatientForBooking) {
      setBookingError('Selecione uma data, horário e paciente.');
      return;
    }

    const token = localStorage.getItem('token');
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          date: dateStr, 
          start_time: selectedTime, 
          end_time: addMinutesToTime(selectedTime, settings.session_duration),
          is_recurring: isRecurring,
          frequency: isRecurring ? frequency : undefined,
          patient_id: selectedPatientForBooking,
          receiveInvite,
          client_date: format(new Date(), 'yyyy-MM-dd'),
          client_time: format(new Date(), 'HH:mm')
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setBookingSuccess('Agendamento realizado com sucesso!');
      setBookingError('');
      fetchData();
      setSelectedDate(null);
      setSelectedTime('');
      setSelectedPatientForBooking('');
    } catch (err: any) {
      setBookingError(err.message);
      setBookingSuccess('');
    }
  };

  const handleDeleteAppointment = async (id: number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao deletar');
      }
      fetchData();
      setDeletingId(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddAvailability = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const day_of_week = formData.get('day_of_week');
    const start_time = formData.get('start_time');
    const end_time = formData.get('end_time');

    const token = localStorage.getItem('token');
    await fetch('/api/availability', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ day_of_week, start_time, end_time }),
    });
    fetchData();
    e.target.reset();
  };

  const handleDeleteAvailability = async (id: number) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/availability/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchData();
  };

  const handleMarkPaid = async (patientId: number) => {
    const token = localStorage.getItem('token');
    const month = format(currentDate, 'MM');
    const year = format(currentDate, 'yyyy');
    
    await fetch('/api/reports/pay', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ patient_id: patientId, month, year }),
    });
    fetchData();
    setMarkingPaidId(null);
  };

  const handleUpdateWorkOnHolidays = async (checked: boolean) => {
    const token = localStorage.getItem('token');
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ work_on_holidays: checked }),
    });
    setSettings({ ...settings, work_on_holidays: checked ? 1 : 0 });
  };

  const handleAddAbsence = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const start_date = formData.get('start_date');
    const end_date = formData.get('end_date');
    const start_time = formData.get('start_time');
    const end_time = formData.get('end_time');
    const reason = formData.get('reason');

    const token = localStorage.getItem('token');
    await fetch('/api/absences', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ 
        start_date, 
        end_date, 
        reason,
        start_time: isAllDayAbsence ? null : start_time,
        end_time: isAllDayAbsence ? null : end_time,
        is_all_day: isAllDayAbsence
      }),
    });
    fetchData();
    e.target.reset();
    setIsAllDayAbsence(true);
  };

  const handleDeleteAbsence = async (id: number) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/absences/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchData();
  };

  const addMinutesToTime = (time: string, mins: number) => {
    const [h, m] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + mins);
    return format(date, 'HH:mm');
  };

  const getAvailableSlots = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');

    // Check Full Day Absences
    const isFullDayAbsent = absences.some(a => {
      if (!a.is_all_day) return false;
      const start = parseISO(a.start_date);
      const end = parseISO(a.end_date);
      return date >= start && date <= end;
    });
    if (isFullDayAbsent) return [];

    // Check Holidays
    const isHoliday = holidays.some(h => h.date === dateStr);
    if (isHoliday && !settings.work_on_holidays) return [];

    // Check Emendas
    const dayOfWeek = date.getDay();
    if (!settings.work_on_holidays) {
      if (dayOfWeek === 1) { // Monday
        const isTuesdayHoliday = holidays.some(h => h.date === format(addDays(date, 1), 'yyyy-MM-dd'));
        if (isTuesdayHoliday) return [];
      }
      if (dayOfWeek === 5) { // Friday
        const isThursdayHoliday = holidays.some(h => h.date === format(subDays(date, 1), 'yyyy-MM-dd'));
        if (isThursdayHoliday) return [];
      }
    }

    // Check if date is in the past
    if (dateStr < format(new Date(), 'yyyy-MM-dd')) return [];

    const avail = availability.filter(a => a.day_of_week === dayOfWeek);
    const slots: string[] = [];

    // Get partial day absences for this date
    const partialAbsences = absences.filter(a => {
      if (a.is_all_day) return false;
      const start = parseISO(a.start_date);
      const end = parseISO(a.end_date);
      return date >= start && date <= end;
    });

    avail.forEach(slot => {
      let current = slot.start_time;
      const end = slot.end_time;
      
      while (current < end) {
        // Check if slot fits within availability
        const slotEnd = addMinutesToTime(current, settings.session_duration);
        if (slotEnd > end) break;

        // Check if slot overlaps with any partial absence
        const isAbsentTime = partialAbsences.some(a => {
          // If absence spans multiple days, and this is a middle day, it's fully absent
          // But partial absences usually are on the same day. Let's assume they apply to the times on the days they cover.
          if (a.start_time && a.end_time) {
            return (current >= a.start_time && current < a.end_time) || 
                   (slotEnd > a.start_time && slotEnd <= a.end_time) ||
                   (current <= a.start_time && slotEnd >= a.end_time);
          }
          return false;
        });

        // Check if slot is already booked
        const isBooked = appointments.some(app => 
          isSameDay(parseISO(app.date), date) && 
          app.start_time === current
        );

        // Check if time is in the past (if today)
        let isPastTime = false;
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        
        if (dateStr === todayStr) {
          const now = new Date();
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          const [h, m] = current.split(':').map(Number);
          if ((h * 60 + m) <= currentMinutes) {
            isPastTime = true;
          }
        }

        if (!isBooked && !isPastTime && !isAbsentTime) {
          slots.push(current);
        }

        // Increment by duration
        current = slotEnd;
      }
    });

    return slots.sort();
  };

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-stone-900">Painel do Terapeuta</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant={selectedTab === 'calendar' ? 'default' : 'outline'} onClick={() => setSelectedTab('calendar')}>
            <CalendarIcon className="mr-2 h-4 w-4" /> Agenda
          </Button>
          <Button variant={selectedTab === 'patients' ? 'default' : 'outline'} onClick={() => setSelectedTab('patients')}>
            <Users className="mr-2 h-4 w-4" /> Pacientes
          </Button>
          <Button variant={selectedTab === 'pending' ? 'default' : 'outline'} onClick={() => setSelectedTab('pending')}>
            <Users className="mr-2 h-4 w-4" /> Solicitações {pendingPatients.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2">{pendingPatients.length}</span>}
          </Button>
          <Button variant={selectedTab === 'reports' ? 'default' : 'outline'} onClick={() => setSelectedTab('reports')}>
            <DollarSign className="mr-2 h-4 w-4" /> Relatórios
          </Button>
          <Button variant={selectedTab === 'availability' ? 'default' : 'outline'} onClick={() => setSelectedTab('availability')}>
            <Clock className="mr-2 h-4 w-4" /> Disponibilidade
          </Button>
          <Button 
            variant={selectedTab === 'checkout' ? 'default' : 'outline'} 
            onClick={() => {
              setSelectedTab('checkout');
              setPlatformPaymentStep('selection');
            }}
            className={selectedTab === 'checkout' ? "bg-red-600 hover:bg-red-700 text-white" : "border-red-600 text-red-600 hover:bg-red-50"}
          >
            <CreditCard className="mr-2 h-4 w-4" /> Checkout
          </Button>
        </div>
      </div>

      {selectedTab === 'calendar' && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">
                  {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                </CardTitle>
                <div className="flex space-x-2">
                  <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium text-stone-500 mb-2">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, idx) => {
                    // Fix timezone issue by treating date string as local
                    const dayAppointments = appointments
                      .filter(app => {
                        const appDate = parseISO(app.date);
                        return isSameDay(appDate, day);
                      })
                      .sort((a, b) => a.start_time.localeCompare(b.start_time));
                    return (
                      <div 
                        key={idx} 
                        onClick={() => setSelectedDate(day)}
                        className={`min-h-[100px] p-2 border rounded-md cursor-pointer transition-colors ${
                          selectedDate && isSameDay(selectedDate, day) ? 'ring-2 ring-stone-900 border-stone-900' : ''
                        } ${
                          isSameMonth(day, currentDate) ? 'bg-white hover:bg-stone-50' : 'bg-stone-50 text-stone-400'
                        }`}
                      >
                        <div className="text-right text-xs mb-1">{format(day, 'd')}</div>
                        <div className="space-y-1">
                          {dayAppointments.map((app, i) => (
                            <div key={i} className="group relative text-xs bg-stone-100 p-1 rounded border border-stone-200" title={`${app.start_time} - ${app.patient_name}`}>
                              <div className="font-medium">{app.start_time}</div>
                              <div className="truncate">{app.patient_name}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Agendamentos do Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-stone-700 uppercase bg-stone-50">
                      <tr>
                        <th className="px-6 py-3">Data</th>
                        <th className="px-6 py-3">Horário</th>
                        <th className="px-6 py-3">Paciente</th>
                        <th className="px-6 py-3">Link</th>
                        <th className="px-6 py-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments
                        .filter(app => isSameMonth(parseISO(app.date), currentDate))
                        .sort((a, b) => {
                          const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
                          if (dateCompare !== 0) return dateCompare;
                          return a.start_time.localeCompare(b.start_time);
                        })
                        .map((app) => (
                        <tr key={app.id} className="bg-white border-b hover:bg-stone-50">
                          <td className="px-6 py-4 font-medium text-stone-900">
                            {format(parseISO(app.date), 'dd/MM/yyyy')}
                          </td>
                          <td className="px-6 py-4">{app.start_time}</td>
                          <td className="px-6 py-4">{app.patient_name}</td>
                          <td className="px-6 py-4">
                            <Button variant="outline" size="sm" asChild>
                              <a 
                                href={getMeetLink(app.meet_link)} 
                                target={app.meet_link ? "_blank" : undefined} 
                                rel="noreferrer"
                                onClick={(e) => {
                                  if (!app.meet_link) {
                                    e.preventDefault();
                                    alert('O link da sessão ainda não foi configurado para este paciente.');
                                  }
                                }}
                              >
                                <Video className="mr-2 h-4 w-4" /> Link da Sessão
                              </a>
                            </Button>
                          </td>
                          <td className="px-6 py-4">
                            {deletingId === app.id ? (
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => handleDeleteAppointment(app.id)}
                                >
                                  Confirmar
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setDeletingId(null)}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => setDeletingId(app.id)}
                              >
                                Deletar
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {appointments.filter(app => isSameMonth(parseISO(app.date), currentDate)).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center text-stone-500">Nenhum agendamento para este mês.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Detalhes do Agendamento</CardTitle>
                <CardDescription>
                  {selectedDate 
                    ? format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR }) 
                    : 'Selecione uma data no calendário'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedDate && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Paciente</label>
                      <select 
                        className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                        value={selectedPatientForBooking}
                        onChange={(e) => setSelectedPatientForBooking(e.target.value)}
                      >
                        <option value="" disabled>Selecione um paciente</option>
                        {patients.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Horários Disponíveis ({settings.session_duration} min)</label>
                      <div className="grid grid-cols-3 gap-2">
                        {getAvailableSlots(selectedDate).map((time) => (
                          <Button
                            key={time}
                            variant={selectedTime === time ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedTime(time)}
                          >
                            {time}
                          </Button>
                        ))}
                        {getAvailableSlots(selectedDate).length === 0 && (
                          <div className="col-span-3 text-sm text-stone-500">Nenhum horário disponível.</div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="recurring"
                          checked={isRecurring}
                          onChange={(e) => setIsRecurring(e.target.checked)}
                          className="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                        />
                        <label htmlFor="recurring" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Repetir agendamento
                        </label>
                      </div>

                      <div className="flex items-center space-x-2 pt-2 border-t border-stone-100">
                        <input
                          type="checkbox"
                          id="receiveInvite"
                          checked={receiveInvite}
                          onChange={(e) => setReceiveInvite(e.target.checked)}
                          className="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                        />
                        <label htmlFor="receiveInvite" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Receber invite por e-mail
                        </label>
                      </div>

                      {isRecurring && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Frequência</label>
                          <select 
                            value={frequency} 
                            onChange={(e) => setFrequency(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                          >
                            <option value="weekly">Semanal (Toda semana)</option>
                            <option value="biweekly">Quinzenal (A cada 2 semanas)</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {bookingError && <div className="text-red-500 text-sm">{bookingError}</div>}
                    {bookingSuccess && <div className="text-green-500 text-sm">{bookingSuccess}</div>}

                    <Button className="w-full" onClick={handleBookAppointment} disabled={!selectedTime || !selectedPatientForBooking}>
                      Confirmar Agendamento
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {selectedTab === 'pending' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações de Pacientes</CardTitle>
              <CardDescription>Aceite novos pacientes para que eles possam acessar o painel.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingPatients.map(patient => (
                  <div key={patient.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                    <div>
                      <h3 className="font-bold text-stone-900">{patient.name}</h3>
                      <p className="text-sm text-stone-500">{patient.email}</p>
                      <p className="text-sm text-stone-500">CPF: {patient.cpf ? formatCPF(patient.cpf) : '-'}</p>
                      <p className="text-sm text-stone-500">Celular: {patient.phone ? formatPhone(patient.phone) : '-'}</p>
                    </div>
                    <Button onClick={() => handleAcceptPatient(patient.id)}>
                      <Check className="mr-2 h-4 w-4" /> Aceitar
                    </Button>
                  </div>
                ))}
                {pendingPatients.length === 0 && (
                  <div className="text-center text-stone-500 py-8">Nenhuma solicitação pendente.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTab === 'patients' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {patients.map((patient) => (
            <Card key={patient.id}>
              <CardHeader>
                <CardTitle>{patient.name}</CardTitle>
                <div className="text-sm text-stone-500">{patient.email}</div>
                <div className="text-sm text-stone-500">CPF: {patient.cpf ? formatCPF(patient.cpf) : '-'}</div>
                <div className="text-sm text-stone-500">Celular: {patient.phone ? formatPhone(patient.phone) : '-'}</div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Valor da Sessão (R$)</label>
                  {editingPatientId === patient.id ? (
                    <div className="space-y-2 p-2 border rounded bg-stone-50">
                      <div>
                        <label className="text-xs text-stone-500">Novo Valor</label>
                        <Input 
                          type="number" 
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          placeholder="Ex: 150.00"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-stone-500">Vigência (Mês/Ano)</label>
                        <Input 
                          type="month" 
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={async () => {
                          if (!editPrice || !editDate) {
                            alert('Preencha o valor e o mês de vigência.');
                            return;
                          }
                          const token = localStorage.getItem('token');
                          await fetch(`/api/patients/${patient.id}`, {
                            method: 'PUT',
                            headers: { 
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}` 
                            },
                            body: JSON.stringify({ 
                              price_per_session: parseFloat(editPrice),
                              effective_date: `${editDate}-01`
                            }),
                          });
                          setEditingPatientId(null);
                          fetchData();
                        }}>Salvar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingPatientId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-bold">R$ {patient.price_per_session?.toFixed(2)}</div>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditingPatientId(patient.id);
                        setEditPrice(patient.price_per_session?.toString() || '');
                        setEditDate(format(new Date(), 'yyyy-MM'));
                      }}>Alterar</Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Link do Google Meet</label>
                  <div className="flex space-x-2">
                    <Input 
                      type="text" 
                      defaultValue={patient.meet_link} 
                      onBlur={(e) => handleUpdatePatient(patient.id, 'meet_link', e.target.value)}
                    />
                    {patient.meet_link && (
                      <Button variant="outline" size="icon" asChild>
                        <a href={patient.meet_link} target="_blank" rel="noreferrer">
                          <LinkIcon className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex items-center space-x-4 bg-white p-4 rounded-lg border border-stone-200 shadow-sm">
            <label className="text-sm font-medium text-stone-700">Mês de Referência:</label>
            <input 
              type="month" 
              className="flex h-10 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Relatório Financeiro - {format(parseISO(`${reportMonth}-01`), 'MMMM yyyy', { locale: ptBR })}</CardTitle>
              <CardDescription>Selecione um paciente para ver os detalhes das sessões.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium">Paciente:</label>
                  <select 
                    className="flex h-10 w-full max-w-xs rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                    onChange={(e) => {
                      const value = e.target.value;
                      const patientId = value ? parseInt(value) : null;
                      setSelectedPatientId(patientId);
                    }}
                    value={selectedPatientId || ''}
                  >
                    <option value="">Selecione um paciente...</option>
                    {reports.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {selectedPatientId && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-stone-700 uppercase bg-stone-50">
                        <tr>
                          <th className="px-6 py-3">Data/Horário</th>
                          <th className="px-6 py-3">Valor</th>
                          <th className="px-6 py-3">Status Pagamento</th>
                          <th className="px-6 py-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments
                          .filter(app => app.patient_id === selectedPatientId && app.date.startsWith(reportMonth))
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .map((app) => {
                            const price = app.price ?? (patients.find(p => p.id === app.patient_id)?.price_per_session || 0);
                            return (
                              <tr key={app.id} className="bg-white border-b hover:bg-stone-50">
                                <td className="px-6 py-4 font-medium text-stone-900">
                                  {format(parseISO(app.date), 'dd/MM/yyyy')} às {app.start_time}
                                </td>
                                <td className="px-6 py-4">
                                  R$ {price.toFixed(2)}
                                </td>
                                <td className={`px-6 py-4 font-medium ${app.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                                  {app.payment_status === 'paid' ? 'Pago' : 'Pendente'}
                                </td>
                                <td className="px-6 py-4">
                                  <Button 
                                    size="sm" 
                                    variant={app.payment_status === 'paid' ? 'outline' : 'default'}
                                    onClick={async () => {
                                      const newStatus = app.payment_status === 'paid' ? 'pending' : 'paid';
                                      const token = localStorage.getItem('token');
                                      await fetch(`/api/appointments/${app.id}/payment`, {
                                        method: 'PUT',
                                        headers: { 
                                          'Content-Type': 'application/json',
                                          Authorization: `Bearer ${token}` 
                                        },
                                        body: JSON.stringify({ status: newStatus }),
                                      });
                                      fetchData();
                                    }}
                                  >
                                    {app.payment_status === 'paid' ? 'Marcar como Pendente' : 'Marcar como Pago'}
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        {appointments.filter(app => app.patient_id === selectedPatientId && app.date.startsWith(reportMonth)).length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-4 text-center text-stone-500">Nenhuma sessão encontrada para este paciente neste mês.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consolidado do Mês - {format(parseISO(`${reportMonth}-01`), 'MMMM yyyy', { locale: ptBR })}</CardTitle>
              <CardDescription>Resumo financeiro de todos os pacientes no mês selecionado.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-stone-700 uppercase bg-stone-50">
                    <tr>
                      <th className="px-6 py-3">Paciente</th>
                      <th className="px-6 py-3 text-center">Qtd. Sessões</th>
                      <th className="px-6 py-3 text-right">Ticket Médio</th>
                      <th className="px-6 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(report => {
                      const sessionCount = report.session_count;
                      const totalValue = report.total_due;
                      const averageTicket = sessionCount > 0 ? totalValue / sessionCount : 0;
                      
                      if (sessionCount === 0) return null;

                      return (
                        <tr key={report.id} className="bg-white border-b hover:bg-stone-50">
                          <td className="px-6 py-4 font-medium text-stone-900">{report.name}</td>
                          <td className="px-6 py-4 text-center">{sessionCount}</td>
                          <td className="px-6 py-4 text-right">R$ {averageTicket.toFixed(2)}</td>
                          <td className="px-6 py-4 text-right font-medium">R$ {totalValue.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    {(() => {
                      const totalSessions = reports.reduce((acc, curr) => acc + curr.session_count, 0);
                      const totalRevenue = reports.reduce((acc, curr) => acc + curr.total_due, 0);
                      const overallAverageTicket = totalSessions > 0 ? totalRevenue / totalSessions : 0;

                      return (
                        <tr className="bg-stone-100 font-bold text-stone-900">
                          <td className="px-6 py-4">Total Geral</td>
                          <td className="px-6 py-4 text-center">{totalSessions}</td>
                          <td className="px-6 py-4 text-right">R$ {overallAverageTicket.toFixed(2)}</td>
                          <td className="px-6 py-4 text-right">R$ {totalRevenue.toFixed(2)}</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTab === 'availability' && (
        <div className="space-y-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Configurações da Agenda</CardTitle>
              <CardDescription>Defina a duração e o intervalo das suas sessões.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateSettings} className="flex flex-col sm:flex-row items-end gap-4">
                <div className="space-y-2 flex-1">
                  <label className="text-sm font-medium">Tempo <strong>total</strong> entre sessões</label>
                  <p className="text-xs text-stone-400">
                    (exemplo: se sua sessão for de 60 minutos e o intervalo pós sessão for 30 minutos, insira 90 minutos)
                  </p>
                  <select 
                    value={settings.session_duration} 
                    onChange={(e) => setSettings({...settings, session_duration: parseInt(e.target.value)})}
                    className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="30">30 minutos</option>
                    <option value="45">45 minutos</option>
                    <option value="60">60 minutos</option>
                    <option value="75">75 minutos</option>
                    <option value="90">90 minutos</option>
                    <option value="105">105 minutos</option>
                    <option value="120">120 minutos</option>
                  </select>
                </div>
                <Button type="submit">Salvar Configuração</Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Horários de Atendimento</CardTitle>
                <CardDescription>Defina seus horários semanais fixos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleAddAvailability} className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <select name="day_of_week" className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm" required>
                      <option value="0">Domingo</option>
                      <option value="1">Segunda</option>
                      <option value="2">Terça</option>
                      <option value="3">Quarta</option>
                      <option value="4">Quinta</option>
                      <option value="5">Sexta</option>
                      <option value="6">Sábado</option>
                    </select>
                    <Input type="time" name="start_time" required />
                    <Input type="time" name="end_time" required />
                  </div>
                  <Button type="submit" className="w-full">Adicionar Horário</Button>
                </form>

                <div className="space-y-2">
                  {availability.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)).map((slot) => (
                    <div key={slot.id} className="flex items-center justify-between p-2 bg-stone-50 rounded border">
                      <div className="text-sm">
                        <span className="font-medium">
                          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][slot.day_of_week]}
                        </span>
                        : {slot.start_time} - {slot.end_time}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteAvailability(slot.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {availability.length === 0 && <div className="text-sm text-stone-500">Nenhum horário definido.</div>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Exceções e Ausências</CardTitle>
                <CardDescription>Gerencie feriados e períodos de folga.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="work_on_holidays"
                    checked={!!settings.work_on_holidays}
                    onChange={(e) => handleUpdateWorkOnHolidays(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                  <label htmlFor="work_on_holidays" className="text-sm font-medium leading-none">
                    Trabalhar em Feriados
                  </label>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">Adicionar Ausência</h4>
                  <form onSubmit={handleAddAbsence} className="space-y-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        id="is_all_day"
                        checked={isAllDayAbsence}
                        onChange={(e) => setIsAllDayAbsence(e.target.checked)}
                        className="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                      />
                      <label htmlFor="is_all_day" className="text-sm font-medium leading-none">
                        Dia todo
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-stone-500">Data Início</label>
                        <Input type="date" name="start_date" required />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-stone-500">Data Fim</label>
                        <Input type="date" name="end_date" required />
                      </div>
                    </div>
                    {!isAllDayAbsence && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-stone-500">Hora Início</label>
                          <Input type="time" name="start_time" required={!isAllDayAbsence} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-stone-500">Hora Fim</label>
                          <Input type="time" name="end_time" required={!isAllDayAbsence} />
                        </div>
                      </div>
                    )}
                    <Input type="text" name="reason" placeholder="Motivo (ex: Férias)" />
                    <Button type="submit" size="sm" className="w-full">Adicionar</Button>
                  </form>
                </div>

                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {absences.map((abs) => (
                    <div key={abs.id} className="flex items-center justify-between p-2 bg-red-50 text-red-900 rounded border border-red-100">
                      <div className="text-xs">
                        <div className="font-medium">{abs.reason || 'Ausência'}</div>
                        <div>
                          {format(parseISO(abs.start_date), 'dd/MM/yyyy')}
                          {abs.start_time && ` ${abs.start_time}`}
                          {' - '}
                          {format(parseISO(abs.end_date), 'dd/MM/yyyy')}
                          {abs.end_time && ` ${abs.end_time}`}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteAbsence(abs.id)} className="text-red-700 hover:text-red-900 hover:bg-red-100">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">
                  Calendário de Disponibilidade - {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                </CardTitle>
                <div className="flex space-x-2">
                  <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium text-stone-500 mb-2">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, idx) => {
                    const dayOfWeek = day.getDay();
                    const dateStr = format(day, 'yyyy-MM-dd');
                    
                    // Check availability
                    const hasSlots = availability.some(a => a.day_of_week === dayOfWeek);
                    
                    // Check holiday
                    const holiday = holidays.find(h => h.date === dateStr);
                    const isHoliday = !!holiday;
                    const isWorkingHoliday = isHoliday && settings.work_on_holidays;
                    
                    // Check Emenda
                    let isEmenda = false;
                    if (!settings.work_on_holidays) {
                      if (dayOfWeek === 1) {
                        isEmenda = holidays.some(h => h.date === format(addDays(day, 1), 'yyyy-MM-dd'));
                      } else if (dayOfWeek === 5) {
                        isEmenda = holidays.some(h => h.date === format(subDays(day, 1), 'yyyy-MM-dd'));
                      }
                    }

                    // Check absence
                    const fullDayAbsence = absences.find(a => {
                      if (!a.is_all_day) return false;
                      const start = parseISO(a.start_date);
                      const end = parseISO(a.end_date);
                      return day >= start && day <= end;
                    });
                    const isFullDayAbsent = !!fullDayAbsence;

                    const partialAbsence = absences.find(a => {
                      if (a.is_all_day) return false;
                      const start = parseISO(a.start_date);
                      const end = parseISO(a.end_date);
                      return day >= start && day <= end;
                    });
                    const hasPartialAbsence = !!partialAbsence;

                    let statusClass = 'bg-stone-50 text-stone-400'; // Default unavailable
                    let statusText = '';
                    const isSelected = selectedCalendarDate && isSameDay(selectedCalendarDate, day);

                    if (isSameMonth(day, currentDate)) {
                      if (isFullDayAbsent) {
                        statusClass = 'bg-red-100 text-red-800 border-red-200';
                        statusText = fullDayAbsence.reason || 'Ausente';
                      } else if (isHoliday && !isWorkingHoliday) {
                        statusClass = 'bg-orange-100 text-orange-800 border-orange-200';
                        statusText = holiday.name;
                      } else if (isEmenda) {
                        statusClass = 'bg-orange-50 text-orange-800 border-orange-200';
                        statusText = 'Emenda';
                      } else if (hasSlots) {
                        statusClass = hasPartialAbsence ? 'bg-yellow-50 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-100' : 'bg-green-50 text-green-800 border-green-200 cursor-pointer hover:bg-green-100';
                        statusText = hasPartialAbsence ? 'Disponível (Parcial)' : 'Disponível';
                      } else {
                        statusClass = 'bg-white text-stone-300'; // Just empty day
                      }
                    }

                    return (
                      <div 
                        key={idx} 
                        onClick={() => {
                          if (hasSlots && !isFullDayAbsent && (!isHoliday || isWorkingHoliday) && !isEmenda && isSameMonth(day, currentDate)) {
                            setSelectedCalendarDate(day);
                          }
                        }}
                        className={`min-h-[80px] p-2 border rounded-md text-xs relative transition-colors ${statusClass} ${isSelected ? 'ring-2 ring-stone-900 border-stone-900' : ''}`}
                      >
                        <div className="text-right mb-1 font-medium">{format(day, 'd')}</div>
                        <div className="font-medium truncate">{statusText}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {selectedCalendarDate && (
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle className="text-lg font-medium">
                    Horários: {format(selectedCalendarDate, 'dd/MM/yyyy')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getAvailableSlots(selectedCalendarDate).length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {getAvailableSlots(selectedCalendarDate).map((slot, i) => (
                          <div key={i} className="p-2 border rounded text-center text-sm bg-stone-50">
                            {slot}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-stone-500 text-center py-4">Nenhum horário disponível.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {selectedTab === 'checkout' && (
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {platformPaymentStep === 'selection' && (
              <motion.div
                key="selection"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card className="border-stone-200 shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-2xl font-serif">Checkout PsyQ</CardTitle>
                    <CardDescription>Pague o percentual de {commissionRate}% sobre seu faturamento de sessões já pagas.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {unpaidPlatformMonths.length === 0 ? (
                      <div className="text-center py-12 text-stone-500 italic">
                        Você está em dia com a plataforma!
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {unpaidPlatformMonths.map((m) => {
                          const id = `${m.month}-${m.year}`;
                          const monthNames: any = {
                            '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
                            '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
                            '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
                          };
                          const amount = m.remaining_amount;
                          
                          // Calculate deadline (15th of next month)
                          const nextMonth = new Date(parseInt(m.year), parseInt(m.month), 15);
                          const isOverdue = new Date() > nextMonth;

                          return (
                            <div 
                              key={id}
                              className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                                selectedPlatformMonths.includes(id) 
                                  ? 'border-stone-900 bg-stone-50 shadow-sm' 
                                  : 'border-stone-100 hover:border-stone-300'
                              }`}
                              onClick={() => handleTogglePlatformMonth(id)}
                            >
                              <div className="flex items-center gap-4">
                                <Checkbox 
                                  checked={selectedPlatformMonths.includes(id)}
                                  onCheckedChange={() => handleTogglePlatformMonth(id)}
                                />
                                <div>
                                  <p className="font-medium text-stone-900">
                                    {monthNames[m.month]} {m.year}
                                  </p>
                                  <p className="text-xs text-stone-500">
                                    Faturamento: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.remaining_revenue)}
                                  </p>
                                  <p className={`text-[10px] font-bold uppercase ${isOverdue ? 'text-red-600' : 'text-stone-400'}`}>
                                    Vencimento: 15/{parseInt(m.month) === 12 ? '01' : (parseInt(m.month) + 1).toString().padStart(2, '0')}/{parseInt(m.month) === 12 ? parseInt(m.year) + 1 : m.year}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-stone-900">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
                                </p>
                                <p className="text-[10px] text-stone-400">({commissionRate}%)</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                  {unpaidPlatformMonths.length > 0 && (
                    <CardFooter className="flex flex-col border-t pt-6 bg-stone-50/50">
                      <div className="flex justify-between w-full mb-6">
                        <span className="text-stone-600 font-medium">Total a Pagar</span>
                        <span className="text-2xl font-bold text-stone-900">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPlatformToPay)}
                        </span>
                      </div>
                      <Button 
                        className="w-full h-12 text-lg bg-red-600 hover:bg-red-700 text-white"
                        disabled={selectedPlatformMonths.length === 0}
                        onClick={handleCreatePayment}
                      >
                        <CreditCard className="mr-2 h-5 w-5" /> Pagar Comissão
                      </Button>
                    </CardFooter>
                  )}
                </Card>

                {/* Platform Payment History */}
                <Card className="mt-8 border-stone-200 shadow-sm overflow-hidden">
                  <CardHeader className="bg-stone-50/50">
                    <CardTitle className="text-lg font-serif">Histórico de Comissões</CardTitle>
                    <CardDescription>Visualize seus pagamentos anteriores à plataforma.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {platformPaymentHistory.length === 0 ? (
                      <div className="p-8 text-center text-stone-400 italic text-sm">
                        Nenhum pagamento registrado ainda.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-stone-100 bg-stone-50/30">
                              <th className="p-4 font-semibold text-stone-600">Mês/Ano</th>
                              <th className="p-4 font-semibold text-stone-600">Faturamento</th>
                              <th className="p-4 font-semibold text-stone-600">Comissão</th>
                              <th className="p-4 font-semibold text-stone-600">Valor Pago</th>
                              <th className="p-4 font-semibold text-stone-600">Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {platformPaymentHistory.map((h) => {
                              const monthNames: any = {
                                1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr',
                                5: 'Mai', 6: 'Jun', 7: 'Jul', 8: 'Ago',
                                9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez'
                              };
                              return (
                                <tr key={h.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                                  <td className="p-4 text-stone-900 font-medium">
                                    {monthNames[h.month]} {h.year}
                                  </td>
                                  <td className="p-4 text-stone-600">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(h.revenue)}
                                  </td>
                                  <td className="p-4 text-stone-500 text-xs">
                                    {h.commission_rate}%
                                  </td>
                                  <td className="p-4 font-bold text-stone-900">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(h.amount)}
                                  </td>
                                  <td className="p-4 text-stone-400 text-xs">
                                    {h.payment_date ? h.payment_date.split('-').reverse().join('/') : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {platformPaymentStep === 'pix' && (
              <motion.div
                key="pix"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card className="border-stone-200 shadow-2xl overflow-hidden">
                  <div className="bg-stone-900 text-white p-6 text-center">
                    <QrCode className="h-12 w-12 mx-auto mb-2 text-emerald-400" />
                    <CardTitle className="text-xl">Pagamento via PIX</CardTitle>
                    <p className="text-stone-400 text-sm">Escaneie o código abaixo para pagar a PsyQ</p>
                  </div>
                  <CardContent className="p-8 flex flex-col items-center">
                    <div className="bg-white p-4 rounded-2xl border-2 border-stone-100 shadow-inner mb-8">
                      {paymentData?.brCodeBase64 ? (
                        <img 
                          src={paymentData.brCodeBase64} // AbacatePay returns base64 image directly? No, usually just base64 string. Let's check doc.
                          // Doc says: "brCodeBase64": "data:image/png;base64,iVBORw0KGgoAAA..."
                          // So it includes the prefix.
                          alt="PIX QR Code"
                          className="w-48 h-48"
                        />
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center bg-stone-100 text-stone-400">
                          Carregando QR Code...
                        </div>
                      )}
                    </div>

                    <div className="w-full space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-stone-500">PIX Copia e Cola</label>
                        <div className="flex gap-2">
                          <div className="flex-1 bg-stone-50 p-3 rounded-lg border border-stone-200 text-xs font-mono break-all line-clamp-2">
                            {paymentData?.brCode || 'Carregando...'}
                          </div>
                          <Button variant="outline" size="icon" onClick={() => {
                            if (paymentData?.brCode) {
                              navigator.clipboard.writeText(paymentData.brCode);
                              alert('Código PIX copiado!');
                            }
                          }} className="shrink-0">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex gap-3 items-start">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-emerald-900">Valor a pagar: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPlatformToPay)}</p>
                          <p className="text-xs text-emerald-700">Aguardando pagamento... A tela atualizará automaticamente.</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-3 p-8 bg-stone-50/50 border-t">
                    <Button 
                      className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={async () => {
                        try {
                          // Manual check
                          const token = localStorage.getItem('token');
                          const res = await fetch(`/api/checkout/status/${paymentData.id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          const data = await res.json();
                          if (data.status === 'PAID') {
                            setPlatformPaymentStep('success');
                            fetchData();
                          } else if (data.status === 'EXPIRED' || data.status === 'CANCELLED' || data.status === 'REFUNDED') {
                            setPlatformPaymentStep('failure');
                          } else {
                            alert('Pagamento ainda não confirmado. Aguarde alguns instantes.');
                          }
                        } catch (err) {
                          console.error('Manual check error:', err);
                          alert('Não foi possível verificar o status agora. Tente novamente em alguns segundos.');
                        }
                      }}
                      disabled={isProcessingPlatformPayment}
                    >
                      {isProcessingPlatformPayment ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...</>
                      ) : (
                        'Já realizei o pagamento'
                      )}
                    </Button>

                    {/* Dev Simulation Button */}
                    <Button 
                      variant="outline"
                      className="w-full border-dashed border-stone-300 text-stone-500 hover:bg-stone-50"
                      onClick={async () => {
                        if (!confirm('Isso simulará o pagamento como se fosse real. Continuar?')) return;
                        setIsProcessingPlatformPayment(true);
                        try {
                          const token = localStorage.getItem('token');
                          const res = await fetch(`/api/checkout/simulate/${paymentData.id}`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          if (!res.ok) throw new Error('Falha na simulação');
                          alert('Pagamento simulado com sucesso! Aguarde a atualização.');
                        } catch (e) {
                          console.error(e);
                          alert('Erro ao simular pagamento.');
                        } finally {
                          setIsProcessingPlatformPayment(false);
                        }
                      }}
                    >
                      🧪 Simular Pagamento (Dev)
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full text-stone-500"
                      onClick={() => setPlatformPaymentStep('selection')}
                      disabled={isProcessingPlatformPayment}
                    >
                      Voltar
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )}

            {platformPaymentStep === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="bg-white p-12 rounded-3xl border border-stone-200 shadow-xl space-y-6">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-serif font-bold text-stone-900">Pagamento Confirmado!</h2>
                    <p className="text-stone-500">Sua comissão com a PsyQ foi quitada com sucesso.</p>
                  </div>
                  <Button 
                    className="w-full bg-stone-900 hover:bg-stone-800"
                    onClick={() => {
                      setPlatformPaymentStep('selection');
                      setSelectedTab('calendar');
                    }}
                  >
                    Voltar ao Painel
                  </Button>
                </div>
              </motion.div>
            )}

            {platformPaymentStep === 'failure' && (
              <motion.div
                key="failure"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="bg-white p-12 rounded-3xl border border-stone-200 shadow-xl space-y-6">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                    <X className="h-10 w-10 text-red-600" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-serif font-bold text-red-900">Pagamento não concluído</h2>
                    <p className="text-stone-500">Houve um problema ao processar seu pagamento ou o tempo expirou.</p>
                  </div>
                  <Button 
                    className="w-full bg-stone-900 hover:bg-stone-800"
                    onClick={() => {
                      setPlatformPaymentStep('selection');
                    }}
                  >
                    Tentar Novamente
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
