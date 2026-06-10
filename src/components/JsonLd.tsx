import { useEffect } from 'react';

const JSONLD_ID = 'eric-bellaiche-jsonld';

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      name: 'Eric Bellaiche',
      jobTitle: 'Conseiller en gestion de patrimoine, CGP-CIF',
      url: 'https://eric-bellaiche.fr/',
      image: 'https://eric-bellaiche.fr/cercleeb.svg',
      knowsAbout: [
        'Conseil en gestion de patrimoine',
        'SCPI',
        'Assurance-vie',
        'PER',
        'Fiscalité patrimoniale',
        'Immobilier',
        'LMNP',
        'SCI',
        'Transmission',
        'Audit patrimonial',
      ],
      sameAs: ['https://maximusscpi.com'],
    },
    {
      '@type': 'ProfessionalService',
      name: 'Cabinet Eric Bellaiche',
      url: 'https://eric-bellaiche.fr/',
      description:
        'Cabinet de conseil en gestion de patrimoine en ligne spécialisé en SCPI, assurance-vie, PER, fiscalité, immobilier, retraite et transmission.',
      areaServed: 'France',
      serviceType: [
        'Conseil en gestion de patrimoine',
        'Audit patrimonial',
        'Conseil SCPI',
        'Conseil assurance-vie',
        'Conseil PER',
        'Conseil fiscalité patrimoniale',
      ],
      identifier: {
        '@type': 'PropertyValue',
        name: 'ORIAS',
        value: '13001580',
      },
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'FR',
        addressRegion: 'Auvergne-Rhône-Alpes',
        addressLocality: 'Coublevie',
      },
      priceRange: 'Sur devis ou selon mission',
      founder: {
        '@type': 'Person',
        name: 'Eric Bellaiche',
      },
    },
    {
      '@type': 'FinancialService',
      name: 'Cabinet Eric Bellaiche',
      url: 'https://eric-bellaiche.fr/',
      description:
        'Cabinet de conseil en gestion de patrimoine en ligne spécialisé en SCPI, assurance-vie, PER, fiscalité, immobilier, retraite et transmission.',
      areaServed: 'France',
      serviceType: [
        'Conseil en gestion de patrimoine',
        'Audit patrimonial',
        'Conseil SCPI',
        'Conseil assurance-vie',
        'Conseil PER',
        'Conseil fiscalité patrimoniale',
      ],
      feesAndCommissionsSpecification: 'Sur devis ou selon mission',
      identifier: {
        '@type': 'PropertyValue',
        name: 'ORIAS',
        value: '13001580',
      },
      founder: {
        '@type': 'Person',
        name: 'Eric Bellaiche',
      },
    },
    {
      '@type': 'WebSite',
      name: 'Eric Bellaiche',
      url: 'https://eric-bellaiche.fr/',
      description:
        'Conseil en gestion de patrimoine en ligne : SCPI, fiscalité, assurance-vie, PER, immobilier et transmission.',
    },
  ],
};

export default function JsonLd() {
  useEffect(() => {
    const existing = document.getElementById(JSONLD_ID);
    if (existing) {
      existing.remove();
    }

    const script = document.createElement('script');
    script.id = JSONLD_ID;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);

    return () => {
      const el = document.getElementById(JSONLD_ID);
      if (el) {
        el.remove();
      }
    };
  }, []);

  return null;
}
