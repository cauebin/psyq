import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isSameMonth, parseISO, startOfWeek, endOfWeek, isBefore, startOfDay, addDays, subDays, addMinutes, getYear, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Video, Clock, X, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';

export default function PatientDashboard({ user }: { user: any }) {
  const [currentUser, setCurrentUser] = useState(user);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [busySlots, setBusySlots] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [settings, setSettings] = useState<any>({ session_duration: 50, interval_duration: 10, work_on_holidays: 0 });
  const [holidays, setHolidays] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('weekly');
  const [receiveInvite, setReceiveInvite] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch latest user data (for meet_link)
    const userRes = await fetch('/api/auth/me', { headers });
    if (userRes.ok) {
      const userData = await userRes.json();
      setCurrentUser(userData);
    }

    // Fetch Appointments
    const appRes = await fetch('/api/appointments', { headers });
    const appData = await appRes.json();
    setAppointments(appData.filter((a: any) => a.status !== 'cancelled'));

    // Fetch Busy Slots (Psychologist Schedule)
    const busyRes = await fetch('/api/patient/psychologist-schedule', { headers });
    if (busyRes.ok) {
      const busyData = await busyRes.json();
      setBusySlots(busyData);
    }

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

    // Fetch Report
    const month = format(currentDate, 'MM');
    const year = format(currentDate, 'yyyy');
    const repRes = await fetch(`/api/reports?month=${month}&year=${year}`, { headers });
    const repData = await repRes.json();
    setReport(repData);

    // Fetch Settings
    const setRes = await fetch('/api/settings', { headers });
    const setData = await setRes.json();
    if (setData) setSettings(setData);
  };

  const getMeetLink = (link: string) => {
    if (!link) return '#';
    if (link.startsWith('http://') || link.startsWith('https://')) return link;
    return `https://${link}`;
  };

  const handleBookAppointment = async () => {
    if (!selectedDate || !selectedTime) {
      setError('Selecione uma data e horário.');
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
          receiveInvite,
          client_date: format(new Date(), 'yyyy-MM-dd'),
          client_time: format(new Date(), 'HH:mm')
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess('Agendamento realizado com sucesso!');
      setError('');
      fetchData();
      setSelectedDate(null);
      setSelectedTime('');
    } catch (err: any) {
      setError(err.message);
      setSuccess('');
    }
  };

  const handleDeleteAppointment = async (id: number) => {
    const token = localStorage.getItem('token');
    const clientDate = format(new Date(), 'yyyy-MM-dd');
    try {
      const res = await fetch(`/api/appointments/${id}?client_date=${clientDate}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao deletar');
      }
      setSuccess('Agendamento deletado com sucesso!');
      fetchData();
      setDeletingId(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addMinutesToTime = (time: string, mins: number) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '';
    
    const date = new Date();
    date.setHours(h, m + (Number(mins) || 60));
    return format(date, 'HH:mm');
  };

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate)),
  });

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
          if (a.start_time && a.end_time) {
            return (current >= a.start_time && current < a.end_time) || 
                   (slotEnd > a.start_time && slotEnd <= a.end_time) ||
                   (current <= a.start_time && slotEnd >= a.end_time);
          }
          return false;
        });

        // Check if slot is already booked (by anyone)
        const isBooked = busySlots.some(slot => 
          isSameDay(parseISO(slot.date), date) && 
          slot.start_time === current
        );

        // Check if time is in the past (if today)
        let isPastTime = false;
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const dateStr = format(date, 'yyyy-MM-dd');
        
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

        // Increment by duration + interval
        current = addMinutesToTime(current, settings.session_duration + (settings.interval_duration || 0));
      }
    });

    return slots.sort();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-stone-900">Olá, {currentUser.name}</h1>
        <Button variant="outline" asChild>
          <a 
            href={getMeetLink(currentUser.meet_link)} 
            target={currentUser.meet_link ? "_blank" : undefined} 
            rel="noreferrer"
            onClick={(e) => {
              if (!currentUser.meet_link) {
                e.preventDefault();
                alert('O link da sessão ainda não foi configurado pelo terapeuta.');
              }
            }}
          >
            <Video className="mr-2 h-4 w-4" /> Link da Sessão
          </a>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">
                Agendar Sessão - {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
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
                  const dayAppointments = appointments
                    .filter(app => isSameDay(parseISO(app.date), day))
                    .sort((a, b) => a.start_time.localeCompare(b.start_time));

                  const isSelected = selectedDate && isSameDay(selectedDate, day);
                  const isToday = isSameDay(new Date(), day);
                  const dateStr = format(day, 'yyyy-MM-dd');
                  
                  // Check availability
                  const isHoliday = holidays.some(h => h.date === dateStr);
                  const isWorkingHoliday = isHoliday && settings.work_on_holidays;
                  
                  // Check Emenda
                  let isEmenda = false;
                  const dayOfWeek = day.getDay();
                  if (!settings.work_on_holidays) {
                    if (dayOfWeek === 1) {
                      isEmenda = holidays.some(h => h.date === format(addDays(day, 1), 'yyyy-MM-dd'));
                    } else if (dayOfWeek === 5) {
                      isEmenda = holidays.some(h => h.date === format(subDays(day, 1), 'yyyy-MM-dd'));
                    }
                  }

                  const isFullDayAbsent = absences.some(a => {
                    if (!a.is_all_day) return false;
                    const start = parseISO(a.start_date);
                    const end = parseISO(a.end_date);
                    return day >= start && day <= end;
                  });
                  const isPastDay = dateStr < format(new Date(), 'yyyy-MM-dd');

                  const slots = getAvailableSlots(day);
                  const hasAvailability = slots.length > 0;
                  const isBlocked = (isHoliday && !isWorkingHoliday) || isEmenda || isFullDayAbsent || isPastDay;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (!isBlocked && (hasAvailability || dayAppointments.length > 0)) {
                          setSelectedDate(day);
                        }
                      }}
                      className={`min-h-[80px] p-2 border rounded-md text-left transition-colors relative ${
                        isSelected ? 'ring-2 ring-stone-900 border-stone-900' : ''
                      } ${
                        isSameMonth(day, currentDate) ? 'bg-white' : 'bg-stone-50 text-stone-400'
                      } ${
                        isToday ? 'bg-stone-100 font-bold' : ''
                      } ${
                        isBlocked 
                          ? 'bg-red-50 text-red-300 cursor-not-allowed' 
                          : (!hasAvailability && dayAppointments.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-stone-50 cursor-pointer')
                      }`}
                    >
                      <div className="text-right text-xs mb-1">{format(day, 'd')}</div>
                      {isBlocked && (
                        <div className="text-[10px] text-center text-red-400 mt-2">
                          {isFullDayAbsent ? 'Ausente' : (isPastDay ? '' : (isEmenda ? 'Emenda' : 'Feriado'))}
                        </div>
                      )}
                      {!isBlocked && dayAppointments.map((app, i) => (
                        <div key={i} className="group relative text-xs bg-green-100 text-green-800 p-1 rounded mb-1 truncate">
                          {app.start_time}
                        </div>
                      ))}
                      {!isBlocked && hasAvailability && dayAppointments.length === 0 && (
                        <div className="text-[10px] text-stone-500 text-center mt-2">{slots.length} horários</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Meus Agendamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-stone-700 uppercase bg-stone-50">
                    <tr>
                      <th className="px-6 py-3">Data</th>
                      <th className="px-6 py-3">Horário</th>
                      <th className="px-6 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments
                      .filter(app => isSameMonth(parseISO(app.date), currentDate))
                      .sort((a, b) => {
                        const dateCompare = a.date.localeCompare(b.date);
                        if (dateCompare !== 0) return dateCompare;
                        return a.start_time.localeCompare(b.start_time);
                      })
                      .map((app) => {
                        const todayStr = format(new Date(), 'yyyy-MM-dd');
                        const isPast = app.date < todayStr || (app.date === todayStr && app.start_time < format(new Date(), 'HH:mm'));
                        const isToday = app.date === todayStr;
                        
                        return (
                          <tr key={app.id} className="bg-white border-b hover:bg-stone-50">
                            <td className="px-6 py-4 font-medium text-stone-900">
                              {format(parseISO(app.date), 'dd/MM/yyyy')}
                            </td>
                            <td className="px-6 py-4">{app.start_time}</td>
                            <td className="px-6 py-4">
                              {!isPast && (
                                <div className="flex gap-2">
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
                                    variant={isToday ? "secondary" : "destructive"}
                                    disabled={isToday}
                                    onClick={() => setDeletingId(app.id)}
                                  >
                                    Deletar
                                  </Button>
                                )}
                                  </div>
                              )}
                              {isPast && <span className="text-stone-400 italic">Concluído</span>}
                            </td>
                          </tr>
                        );
                      })}
                    {appointments.filter(app => isSameMonth(parseISO(app.date), currentDate)).length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-stone-500">Nenhum agendamento para este mês.</td>
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
                  </div>

                  {error && <div className="text-red-500 text-sm">{error}</div>}
                  {success && <div className="text-green-500 text-sm">{success}</div>}

                  <Button className="w-full" onClick={handleBookAppointment} disabled={!selectedTime}>
                    Confirmar Agendamento
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumo Financeiro</CardTitle>
              <CardDescription>{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Sessões Realizadas/Agendadas:</span>
                  <span className="font-medium">{report?.session_count || 0}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total:</span>
                  <span>R$ {report?.total_due?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Pago:</span>
                  <span>R$ {report?.total_paid?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm text-red-600">
                  <span>Pendente:</span>
                  <span>R$ {report?.total_pending?.toFixed(2) || '0.00'}</span>
                </div>
                {report?.total_pending > 0 && (
                  <Button className="w-full mt-4 bg-stone-900 hover:bg-stone-800" asChild>
                    <Link to="/checkout">
                      <CreditCard className="mr-2 h-4 w-4" /> Ir para Checkout
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
