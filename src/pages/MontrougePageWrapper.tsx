import { useEffect } from 'react';
import CityPage from '../components/CityPage';
import { cities } from '../data/cities';

export default function MontrougePageWrapper() {
  useEffect(() => {
    document.title = `${cities.montrouge.adTitle1} - Eric Bellaiche`;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', cities.montrouge.metaDescription);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = cities.montrouge.metaDescription;
      document.head.appendChild(meta);
    }
  }, []);

  return <CityPage cityData={cities.montrouge} />;
}
