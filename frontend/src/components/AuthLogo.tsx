import logoMark from '../assets/los-laureles-logo.png';
import { useConfig } from '../lib/useConfig';

export const AuthLogo = () => {
  const { data: config } = useConfig();
  return (
    <div className="mb-5 flex justify-center">
      <img
        src={config?.logoDataUrl || logoMark}
        alt={config?.nombreUnidad || 'Logo'}
        className="h-20 w-20 object-contain"
      />
    </div>
  );
};
