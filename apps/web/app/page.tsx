import { Dashboard } from '@/components/Dashboard';
import { WS_URL } from '@/lib/config';

export default function HomePage() {
  return <Dashboard wsUrl={WS_URL} />;
}
