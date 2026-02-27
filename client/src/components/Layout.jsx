import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout({ children }) {
  const { requiresAuth, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            <Link to="/" className="text-xl font-bold text-indigo-600">
              MailSwitch
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/jobs" className="text-sm text-gray-600 hover:text-gray-900">
                Jobs
              </Link>
              <Link
                to="/"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                New Migration
              </Link>
              {requiresAuth && (
                <button
                  onClick={logout}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        MailSwitch v1.0.0
      </footer>
    </div>
  );
}
