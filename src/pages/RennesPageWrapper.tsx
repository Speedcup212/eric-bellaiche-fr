import { useEffect } from 'react';
import CityPage from '../components/CityPage';
import { cities } from '../data/cities';

export default function RennesPageWrapper() {
  useEffect(() => {
    document.title = `${cities.rennes.adTitle1} - Eric Bellaiche`;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', cities.rennes.metaDescription);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = cities.rennes.metaDescription;
      document.head.appendChild(meta);
    }
  }, []);

  return <CityPage cityData={cities.rennes} />;
}
