import { useEffect } from 'react';
import CityPage from '../components/CityPage';
import { cities } from '../data/cities';

export default function GrenoblePageWrapper() {
  useEffect(() => {
    document.title = `${cities.grenoble.adTitle1} - Eric Bellaiche`;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', cities.grenoble.metaDescription);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = cities.grenoble.metaDescription;
      document.head.appendChild(meta);
    }
  }, []);

  return <CityPage cityData={cities.grenoble} />;
}
