import { useEffect } from 'react';
import CityPage from '../components/CityPage';
import { cities } from '../data/cities';

export default function ToulousePageWrapper() {
  useEffect(() => {
    document.title = `${cities.toulouse.adTitle1} - Eric Bellaiche`;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', cities.toulouse.metaDescription);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = cities.toulouse.metaDescription;
      document.head.appendChild(meta);
    }
  }, []);

  return <CityPage cityData={cities.toulouse} />;
}
