import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthSkeleton } from './Skeleton';

const RutaProtegida = ({ children }) => {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return <AuthSkeleton />;
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default RutaProtegida;
