import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function WaitingApproval({ user, setUser }: { user: any, setUser: any }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Aguardando Aprovação</CardTitle>
          <CardDescription>
            Sua solicitação foi enviada para {user.psychologist_name || 'seu terapeuta'}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-stone-600">
            Você precisa aguardar o aceite do terapeuta para acessar o painel. 
            Entre em contato com ele(a) caso precise de urgência.
          </p>
          <Button variant="outline" onClick={handleLogout} className="w-full">
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
