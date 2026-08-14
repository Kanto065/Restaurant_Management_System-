import { useNavigate } from 'react-router-dom';
import CartPanel from '../components/CartPanel';

export default function Cart() {
  const navigate = useNavigate();

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-6">
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="w-9 h-9 rounded-full bg-brand-bg-light text-brand-cream flex items-center justify-center mb-4"
      >
        ←
      </button>
      <CartPanel />
    </div>
  );
}
