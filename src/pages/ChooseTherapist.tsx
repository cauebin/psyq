import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, User } from 'lucide-react';

export default function ChooseTherapist({ setUser }: { setUser: any }) {
  const [psychologists, setPsychologists] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/psychologists')
      .then(res => res.json())
      .then(data => setPsychologists(data))
      .catch(err => console.error(err));
  }, []);

  const handleSelect = async (psychologistId: number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/patients/select-psychologist', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ psychologist_id: psychologistId }),
      });

      if (!res.ok) throw new Error('Failed to select psychologist');
      
      const data = await res.json();
      setUser(data.user);
      navigate('/');
    } catch (err) {
      console.error(err);
      alert('Erro ao selecionar terapeuta.');
    }
  };

  const filteredPsychologists = psychologists.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center space-y-4 max-w-2xl">
        <h1 className="text-3xl font-bold text-stone-900">Escolha seu Terapeuta</h1>
        <p className="text-stone-600">
          Para continuar, selecione o profissional que irá lhe atender.
        </p>
      </div>

      <div className="w-full max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 h-5 w-5" />
        <Input 
          className="pl-10 h-12 text-lg" 
          placeholder="Buscar terapeuta..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="w-full max-w-md space-y-3">
        {filteredPsychologists.map(psychologist => (
          <Card 
            key={psychologist.id} 
            className="cursor-pointer hover:shadow-md transition-shadow border-stone-200"
            onClick={() => handleSelect(psychologist.id)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center text-stone-500">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900">{psychologist.name}</h3>
                  <p className="text-sm text-stone-500">Psicóloga(o)</p>
                </div>
              </div>
              <Button variant="ghost" size="sm">Selecionar</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
