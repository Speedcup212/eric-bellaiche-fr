import { useEffect } from 'react';
import CityPage from '../components/CityPage';
import { cities } from '../data/cities';

export default function AixPageWrapper() {
  useEffect(() => {
    document.title = `${cities['aix-en-provence'].adTitle1} - Eric Bellaiche`;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', cities['aix-en-provence'].metaDescription);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = cities['aix-en-provence'].metaDescription;
      document.head.appendChild(meta);
    }
  }, []);

  return <CityPage cityData={cities['aix-en-provence']} />;
}
