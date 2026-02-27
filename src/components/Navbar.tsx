import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon } from 'lucide-react';

export default function Navbar({ user, setUser }: { user: any, setUser: any }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/');
  };

  const brandName = user.role === 'psychologist' ? user.name : (user.psychologist_name || 'PsyQ | Terapias');

  return (
    <nav className="bg-white shadow-sm border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="font-serif text-xl font-medium text-stone-800">{brandName}</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/profile" className="flex items-center text-sm text-stone-600 hover:text-stone-900 transition-colors">
              <UserIcon className="h-4 w-4 mr-2" />
              {user.name} ({user.role === 'psychologist' ? 'Terapeuta' : 'Paciente'})
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-stone-500 hover:text-stone-700 focus:outline-none transition ease-in-out duration-150"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
