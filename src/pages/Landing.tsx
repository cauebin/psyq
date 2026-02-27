import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { User, HeartHandshake } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 gap-12">
      <div className="text-center space-y-4 max-w-2xl">
        <div className="w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6">
          P
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-stone-900 tracking-tight">
          PsyQ | Terapias
        </h1>
        <p className="text-xl text-stone-600">
          Conectando pacientes e terapeutas de forma simples e eficiente.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md sm:max-w-2xl justify-center">
        <Button 
          asChild 
          className="h-auto py-8 px-8 text-lg flex flex-col gap-3 hover:scale-105 transition-transform"
          variant="outline"
        >
          <Link to="/login?role=patient">
            <User className="w-12 h-12 mb-2" />
            <span>Sou Paciente</span>
          </Link>
        </Button>

        <Button 
          asChild 
          className="h-auto py-8 px-8 text-lg flex flex-col gap-3 hover:scale-105 transition-transform bg-stone-900 text-white hover:bg-stone-800"
        >
          <Link to="/login?role=psychologist">
            <HeartHandshake className="w-12 h-12 mb-2" />
            <span>Sou Terapeuta</span>
          </Link>
        </Button>
      </div>

      <footer className="absolute bottom-6 text-center text-stone-400 text-sm">
        &copy; {new Date().getFullYear()} PsyQ. Todos os direitos reservados.
      </footer>
    </div>
  );
}
