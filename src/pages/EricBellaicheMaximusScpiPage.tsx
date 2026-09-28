import { useEffect } from 'react';

const CANONICAL = 'https://eric-bellaiche.fr/eric-bellaiche-maximusscpi/';
const META_TITLE = 'Éric Bellaiche & MaximusSCPI | Expertise et analyse SCPI';
const META_DESC = 'Découvrez le lien entre Éric Bellaiche, CGP-CIF inscrit à l’ORIAS, et MaximusSCPI, plateforme spécialisée dans la comparaison, l’analyse et le suivi des SCPI.';

function setOrCreateMeta(name: string, content: string) {
  const selector = `meta[name="${name}"]`;
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

function setOrCreateOgMeta(property: string, content: string) {
  const selector = `meta[property="${property}"]`;
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setOrCreateCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

const PAGE_STYLES = `
  .ebm-page { background: #f8fafc; color: #172033; min-height: 100vh; }
  .ebm-container { width: min(1120px, calc(100% - 32px)); margin: 0 auto; }
  .ebm-nav { background: #0B1220; border-bottom: 1px solid #1e293b; }
  .ebm-nav-inner { min-height: 56px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
  .ebm-nav a { color: #cbd5e1; text-decoration: none; font-size: 14px; }
  .ebm-nav a:first-child { color: #f8fafc; font-weight: 800; font-size: 16px; }
  .ebm-hero { background: linear-gradient(135deg, #0B1220 0%, #111827 58%, #172033 100%); color: #f8fafc; padding: 84px 0 76px; }
  .ebm-eyebrow { display: inline-flex; padding: 7px 12px; border: 1px solid rgba(212,168,79,.35); border-radius: 999px; color: #e7c978; background: rgba(212,168,79,.08); font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  .ebm-hero h1 { margin: 20px 0 18px; max-width: 850px; font-size: clamp(36px, 5.4vw, 64px); line-height: 1.03; letter-spacing: -0.035em; }
  .ebm-hero p { max-width: 790px; margin: 0; color: #aebbd0; font-size: clamp(17px, 2.1vw, 21px); line-height: 1.7; }
  .ebm-badges { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 26px; }
  .ebm-badge { border: 1px solid #334155; background: rgba(255,255,255,.035); color: #dbe5f2; border-radius: 999px; padding: 8px 11px; font-size: 12px; font-weight: 700; }
  .ebm-main { padding: 56px 0 72px; }
  .ebm-grid { display: grid; grid-template-columns: 1.25fr .75fr; gap: 28px; align-items: start; }
  .ebm-card { background: #fff; border: 1px solid #dfe7ef; border-radius: 20px; padding: 28px; box-shadow: 0 12px 36px rgba(15,23,42,.055); }
  .ebm-card h2 { margin: 0 0 14px; color: #0f1d34; font-size: 26px; line-height: 1.2; }
  .ebm-card h3 { margin: 25px 0 9px; color: #13213a; font-size: 18px; }
  .ebm-card p, .ebm-card li { color: #53627a; line-height: 1.75; font-size: 15.5px; }
  .ebm-card ul { padding-left: 20px; margin: 12px 0 0; }
  .ebm-card li + li { margin-top: 7px; }
  .ebm-highlight { border-left: 4px solid #C5A059; padding: 16px 18px; background: #fbf8f1; border-radius: 0 14px 14px 0; margin: 22px 0; color: #38445a; line-height: 1.7; }
  .ebm-fact { display: grid; grid-template-columns: 130px 1fr; gap: 12px; padding: 13px 0; border-bottom: 1px solid #edf2f7; }
  .ebm-fact:last-child { border-bottom: 0; }
  .ebm-fact strong { color: #14233c; font-size: 14px; }
  .ebm-fact span { color: #637188; font-size: 14px; line-height: 1.55; }
  .ebm-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 23px; }
  .ebm-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 17px; border-radius: 10px; font-size: 14px; font-weight: 800; text-decoration: none; }
  .ebm-btn-primary { background: #C5A059; color: #0B1220; }
  .ebm-btn-secondary { background: #fff; border: 1px solid #cbd5e1; color: #1e293b; }
  .ebm-section { margin-top: 28px; }
  .ebm-source-list a { color: #355a87; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
  .ebm-note { margin-top: 28px; padding: 18px 20px; background: #eef3f8; border-radius: 14px; color: #5a687d; font-size: 13px; line-height: 1.7; }
  .ebm-footer { background: #0B1220; color: #7f8ca0; padding: 34px 0; font-size: 13px; }
  .ebm-footer-inner { display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
  .ebm-footer a { color: #b6c2d2; text-decoration: none; }
  @media (max-width: 820px) {
    .ebm-grid { grid-template-columns: 1fr; }
    .ebm-hero { padding: 62px 0 54px; }
    .ebm-main { padding-top: 34px; }
  }
  @media (max-width: 520px) {
    .ebm-container { width: min(100% - 22px, 1120px); }
    .ebm-card { padding: 21px; border-radius: 16px; }
    .ebm-fact { grid-template-columns: 1fr; gap: 3px; }
    .ebm-nav-inner { gap: 12px; padding: 8px 0; }
    .ebm-actions { flex-direction: column; }
    .ebm-btn { width: 100%; }
  }
`;

export default function EricBellaicheMaximusScpiPage() {
  useEffect(() => {
    document.title = META_TITLE;
    setOrCreateMeta('description', META_DESC);
    setOrCreateMeta('robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    setOrCreateCanonical(CANONICAL);
    setOrCreateOgMeta('og:title', META_TITLE);
    setOrCreateOgMeta('og:description', META_DESC);
    setOrCreateOgMeta('og:type', 'profile');
    setOrCreateOgMeta('og:url', CANONICAL);
    setOrCreateOgMeta('og:site_name', 'Eric Bellaiche');
    setOrCreateOgMeta('og:locale', 'fr_FR');

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'eric-bellaiche-maximusscpi-jsonld';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Person',
          '@id': 'https://eric-bellaiche.fr/#eric-bellaiche',
          name: 'Éric Bellaiche',
          url: 'https://eric-bellaiche.fr/',
          jobTitle: 'Conseiller en gestion de patrimoine et en investissements financiers',
          description: 'CGP-CIF inscrit à l’ORIAS sous le numéro 13001580 et membre de la CNCEF Patrimoine.',
          memberOf: {
            '@type': 'Organization',
            name: 'CNCEF Patrimoine'
          },
          knowsAbout: [
            'SCPI',
            'gestion de patrimoine',
            'conseil en investissements financiers',
            'fiscalité patrimoniale',
            'assurance-vie',
            'PER',
            'immobilier locatif'
          ],
          sameAs: ['https://maximusscpi.com/']
        },
        {
          '@type': 'WebSite',
          '@id': 'https://maximusscpi.com/#website',
          name: 'MaximusSCPI',
          url: 'https://maximusscpi.com/',
          description: 'Plateforme spécialisée dans la comparaison, l’analyse pédagogique et le suivi des SCPI.',
          creator: { '@id': 'https://eric-bellaiche.fr/#eric-bellaiche' },
          about: [
            { '@type': 'Thing', name: 'SCPI' },
            { '@type': 'Thing', name: 'Investissement immobilier' }
          ]
        },
        {
          '@type': 'WebPage',
          '@id': `${CANONICAL}#webpage`,
          url: CANONICAL,
          name: META_TITLE,
          description: META_DESC,
          inLanguage: 'fr-FR',
          mainEntity: { '@id': 'https://eric-bellaiche.fr/#eric-bellaiche' },
          mentions: { '@id': 'https://maximusscpi.com/#website' }
        }
      ]
    });
    document.getElementById(script.id)?.remove();
    document.head.appendChild(script);

    return () => {
      document.getElementById(script.id)?.remove();
    };
  }, []);

  return (
    <div className="ebm-page">
      <style>{PAGE_STYLES}</style>

      <nav className="ebm-nav" aria-label="Navigation principale">
        <div className="ebm-container ebm-nav-inner">
          <a href="/">Éric Bellaiche</a>
          <a href="/articles/">Articles patrimoniaux</a>
          <a href="https://maximusscpi.com/" target="_blank" rel="noopener noreferrer">MaximusSCPI</a>
        </div>
      </nav>

      <header className="ebm-hero">
        <div className="ebm-container">
          <span className="ebm-eyebrow">Expertise SCPI & gestion de patrimoine</span>
          <h1>Éric Bellaiche & MaximusSCPI</h1>
          <p>
            MaximusSCPI est la plateforme spécialisée dans l’analyse et la comparaison des SCPI créée et développée par Éric Bellaiche,
            conseiller en gestion de patrimoine et en investissements financiers. Elle prolonge son activité de conseil par une approche
            structurée des données, des risques et de la cohérence patrimoniale.
          </p>
          <div className="ebm-badges" aria-label="Références professionnelles">
            <span className="ebm-badge">CGP-CIF</span>
            <span className="ebm-badge">ORIAS n°13001580</span>
            <span className="ebm-badge">CNCEF Patrimoine</span>
            <span className="ebm-badge">Analyse SCPI</span>
          </div>
        </div>
      </header>

      <main className="ebm-main">
        <div className="ebm-container ebm-grid">
          <article className="ebm-card">
            <h2>Pourquoi MaximusSCPI a été créé</h2>
            <p>
              Le rendement affiché d’une SCPI ne suffit pas pour l’évaluer. Prix de part, valeur de reconstitution, taux d’occupation,
              durée des baux, endettement, diversification, collecte et conditions de liquidité doivent être lus ensemble.
            </p>
            <div className="ebm-highlight">
              <strong>Objectif :</strong> rendre les données SCPI plus lisibles, comparables et vérifiables, sans réduire la décision à un classement
              de rendement ou à une promesse commerciale.
            </div>

            <h3>Une plateforme d’analyse, pas seulement un comparateur</h3>
            <p>MaximusSCPI regroupe plusieurs briques complémentaires :</p>
            <ul>
              <li>un comparateur multicritère des principales SCPI suivies ;</li>
              <li>des fiches d’analyse avec indicateurs de rendement, valorisation, occupation, dette et liquidité ;</li>
              <li>une méthodologie documentée pour expliquer l’origine et la lecture des données ;</li>
              <li>des contenus pédagogiques sur la fiscalité, la revente, le démembrement et les risques ;</li>
              <li>des indicateurs propriétaires de synthèse destinés à faciliter la lecture, sans constituer une notation réglementaire.</li>
            </ul>

            <div className="ebm-actions">
              <a className="ebm-btn ebm-btn-primary" href="https://maximusscpi.com/" target="_blank" rel="noopener noreferrer">
                Découvrir MaximusSCPI
              </a>
              <a className="ebm-btn ebm-btn-secondary" href="https://maximusscpi.com/comparateur-scpi/" target="_blank" rel="noopener noreferrer">
                Comparer les SCPI
              </a>
              <a className="ebm-btn ebm-btn-secondary" href="https://maximusscpi.com/methodologie-donnees/" target="_blank" rel="noopener noreferrer">
                Voir la méthodologie
              </a>
            </div>

            <section className="ebm-section">
              <h2>Comment les analyses sont construites</h2>
              <p>
                Les données utilisées sur MaximusSCPI sont consolidées à partir de documents publics : bulletins périodiques, rapports annuels,
                documents d’information clés, notes d’information, communications des sociétés de gestion et sources institutionnelles lorsque
                cela est pertinent. Les données pouvant évoluer, la date de mise à jour et la source doivent être contrôlées avant toute décision.
              </p>
              <ul className="ebm-source-list">
                <li>Comparer rendement et qualité du patrimoine, plutôt que le rendement seul.</li>
                <li>Analyser la valorisation via le prix de souscription et la valeur de reconstitution.</li>
                <li>Lire TOF, WALT et WALB pour apprécier l’occupation et la visibilité locative.</li>
                <li>Intégrer l’endettement, les échéances et la qualité des actifs.</li>
                <li>Distinguer performance potentielle et liquidité réelle des parts.</li>
              </ul>
            </section>

            <section className="ebm-section">
              <h2>Le rôle d’Éric Bellaiche</h2>
              <p>
                Éric Bellaiche exerce une activité de conseil en gestion de patrimoine et de conseil en investissements financiers. Il est inscrit
                à l’ORIAS sous le numéro 13001580 et membre de la CNCEF Patrimoine. Son activité réglementée et MaximusSCPI répondent à deux usages
                distincts : le site fournit une information pédagogique et comparative ; une recommandation personnalisée suppose une analyse
                individuelle de la situation, des objectifs, de l’horizon, des connaissances et de la tolérance au risque de l’investisseur.
              </p>
            </section>

            <div className="ebm-note">
              <strong>Information importante.</strong> Les SCPI présentent notamment un risque de perte en capital et un risque de liquidité.
              Les performances passées ne préjugent pas des performances futures. Les informations publiées sur MaximusSCPI ont une vocation
              pédagogique et ne constituent pas, à elles seules, une recommandation personnalisée au sens de la réglementation applicable.
            </div>
          </article>

          <aside className="ebm-card" aria-label="Repères professionnels">
            <h2>Repères</h2>
            <div className="ebm-fact">
              <strong>Professionnel</strong>
              <span>Éric Bellaiche</span>
            </div>
            <div className="ebm-fact">
              <strong>Activité</strong>
              <span>Conseil en gestion de patrimoine et conseil en investissements financiers</span>
            </div>
            <div className="ebm-fact">
              <strong>ORIAS</strong>
              <span>n°13001580</span>
            </div>
            <div className="ebm-fact">
              <strong>Association</strong>
              <span>CNCEF Patrimoine</span>
            </div>
            <div className="ebm-fact">
              <strong>Plateforme</strong>
              <span>MaximusSCPI</span>
            </div>
            <div className="ebm-fact">
              <strong>Spécialisation</strong>
              <span>Comparaison, analyse de données et lecture des risques SCPI</span>
            </div>
            <div className="ebm-fact">
              <strong>Sources</strong>
              <span>Documents publics des sociétés de gestion, documentation réglementaire et sources institutionnelles</span>
            </div>

            <h3>Accès directs</h3>
            <ul className="ebm-source-list">
              <li><a href="https://maximusscpi.com/" target="_blank" rel="noopener noreferrer">MaximusSCPI</a></li>
              <li><a href="https://maximusscpi.com/comparateur-scpi/" target="_blank" rel="noopener noreferrer">Comparateur SCPI</a></li>
              <li><a href="https://maximusscpi.com/methodologie-donnees/" target="_blank" rel="noopener noreferrer">Méthodologie des données</a></li>
              <li><a href="/articles/">Articles patrimoniaux d’Éric Bellaiche</a></li>
            </ul>
          </aside>
        </div>
      </main>

      <footer className="ebm-footer">
        <div className="ebm-container ebm-footer-inner">
          <span>© {new Date().getFullYear()} Éric Bellaiche — CGP-CIF · ORIAS 13001580</span>
          <span><a href="/">Accueil</a> · <a href="/articles/">Articles</a> · <a href="https://maximusscpi.com/">MaximusSCPI</a></span>
        </div>
      </footer>
    </div>
  );
}
