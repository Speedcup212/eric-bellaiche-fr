import { useEffect } from 'react';
import CityPage from '../components/CityPage';
import { cities } from '../data/cities';

function setOrCreateMeta(name: string, content: string) {
  const selector = `meta[name="${name}"]`;
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (el) {
    el.setAttribute('content', content);
  } else {
    el = document.createElement('meta');
    el.name = name;
    el.content = content;
    document.head.appendChild(el);
  }
}

function setOrCreateOgMeta(property: string, content: string) {
  const selector = `meta[property="${property}"]`;
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (el) {
    el.setAttribute('content', content);
  } else {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    el.content = content;
    document.head.appendChild(el);
  }
}

function setOrCreateCanonical(href: string) {
  const selector = 'link[rel="canonical"]';
  let el = document.querySelector(selector) as HTMLLinkElement | null;
  if (el) {
    el.setAttribute('href', href);
  } else {
    el = document.createElement('link');
    el.rel = 'canonical';
    el.href = href;
    document.head.appendChild(el);
  }
}

export default function HomePage() {
  useEffect(() => {
    // Title
    document.title = 'Eric Bellaiche — Conseiller en gestion de patrimoine, CGP-CIF, SCPI & fiscalité';

    // Meta description
    setOrCreateMeta(
      'description',
      'Conseiller en gestion de patrimoine en ligne, Eric Bellaiche accompagne les particuliers dans leurs projets SCPI, assurance-vie, PER, fiscalité, immobilier, retraite et transmission. Cabinet CGP-CIF inscrit ORIAS n°13001580.'
    );

    // OpenGraph
    setOrCreateOgMeta('og:title', 'Eric Bellaiche — Conseiller en gestion de patrimoine');
    setOrCreateOgMeta(
      'og:description',
      'Accompagnement patrimonial en ligne : SCPI, fiscalité, assurance-vie, PER, immobilier et transmission.'
    );
    setOrCreateOgMeta('og:type', 'website');
    setOrCreateOgMeta('og:url', 'https://eric-bellaiche.fr');

    // Canonical
    setOrCreateCanonical('https://eric-bellaiche.fr/');
  }, []);

  return <CityPage cityData={cities.grenoble} />;
}
