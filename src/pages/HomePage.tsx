import { useEffect } from 'react';
import CityPage from '../components/CityPage';
import { cities } from '../data/cities';

export default function HomePage() {
  useEffect(() => {
    document.title = 'Eric Bellaiche - Conseil en Gestion de Patrimoine';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Conseil en investissement et gestion de patrimoine. Bilan personnalisé offert de 30min en visio avec Eric Bellaiche, expert indépendant (30 ans d\'expérience).');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Conseil en investissement et gestion de patrimoine. Bilan personnalisé offert de 30min en visio avec Eric Bellaiche, expert indépendant (30 ans d\'expérience).';
      document.head.appendChild(meta);
    }
  }, []);

  return <CityPage cityData={cities.grenoble} />;
}
