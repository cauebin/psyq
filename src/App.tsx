import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PatientDashboard from './pages/PatientDashboard';
import Landing from './pages/Landing';
import ChooseTherapist from './pages/ChooseTherapist';
import Profile from './pages/Profile';
import WaitingApproval from './pages/WaitingApproval';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Checkout from './pages/Checkout';
import Navbar from './components/Navbar';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { useEffect, useState } from 'react';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.id) setUser(data);
      })
      .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  const isAdmin = user?.role === 'admin';
  const isPsychologist = user?.role === 'psychologist';
  const isPatient = user?.role === 'patient';

  return (
    <Router>
      <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
        <PWAInstallPrompt />
        {user && !isAdmin && <Navbar user={user} setUser={setUser} />}
        <main className={user && !isAdmin ? "max-w-7xl mx-auto p-4 sm:p-6 lg:p-8" : ""}>
          <Routes>
            <Route 
              path="/" 
              element={
                !user ? <Landing /> : 
                isAdmin ? <Navigate to="/admin-dashboard" /> :
                isPsychologist ? <Dashboard user={user} /> : 
                !user.psychologist_id ? <Navigate to="/choose-therapist" /> :
                !user.accepted ? <WaitingApproval user={user} setUser={setUser} /> :
                <PatientDashboard user={user} />
              } 
            />
            <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to="/" />} />
            <Route path="/register" element={!user ? <Register setUser={setUser} /> : <Navigate to="/" />} />
            <Route path="/admin-login" element={!user ? <AdminLogin setUser={setUser} /> : <Navigate to="/" />} />
            <Route path="/admin-dashboard" element={user && isAdmin ? <AdminDashboard user={user} setUser={setUser} /> : <Navigate to="/" />} />
            <Route path="/checkout" element={user && isPatient ? <Checkout user={user} /> : <Navigate to="/" />} />
            <Route path="/choose-therapist" element={user && isPatient && !user.psychologist_id ? <ChooseTherapist setUser={setUser} /> : <Navigate to="/" />} />
            <Route path="/profile" element={user ? <Profile user={user} setUser={setUser} /> : <Navigate to="/" />} />
            
            {/* Legacy routes kept for compatibility but redirecting to main flow */}
            <Route path="/p/:psychologistId/login" element={<Navigate to="/login" />} />
            <Route path="/p/:psychologistId/register" element={<Navigate to="/register" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
