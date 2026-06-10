import CityPage from '../components/CityPage';
import { cities } from '../data/cities';

export default function HomePage() {
  return <CityPage cityData={cities.grenoble} />;
}
