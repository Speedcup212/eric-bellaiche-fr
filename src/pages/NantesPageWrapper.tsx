import { useEffect } from 'react';
import CityPage from '../components/CityPage';
import { cities } from '../data/cities';

export default function NantesPageWrapper() {
  useEffect(() => {
    document.title = `${cities.nantes.adTitle1} - Eric Bellaiche`;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', cities.nantes.metaDescription);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = cities.nantes.metaDescription;
      document.head.appendChild(meta);
    }
  }, []);

  return <CityPage cityData={cities.nantes} />;
}
