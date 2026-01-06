import React, { useState, useEffect } from 'react';
import { X, Shield, Cookie } from 'lucide-react';

interface ConsentPreferences {
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

const ConsentBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    analytics: false,
    marketing: false,
    timestamp: 0
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => {
          setShowBanner(true);
        }, { timeout: 2000 });
      } else {
        setTimeout(() => setShowBanner(true), 1500);
      }
    } else {
      const savedPreferences = JSON.parse(consent);
      setPreferences(savedPreferences);
      updateConsentMode(savedPreferences.analytics, savedPreferences.marketing);
    }
  }, []);

  const updateConsentMode = (analytics: boolean, marketing: boolean) => {
    if (window.gtag) {
      window.gtag('consent', 'update', {
        'analytics_storage': analytics ? 'granted' : 'denied',
        'ad_storage': marketing ? 'granted' : 'denied',
        'ad_user_data': marketing ? 'granted' : 'denied',
        'ad_personalization': marketing ? 'granted' : 'denied',
        'personalization_storage': analytics ? 'granted' : 'denied'
      });
    }
  };

  const saveConsent = (analytics: boolean, marketing: boolean) => {
    const consentData: ConsentPreferences = {
      analytics,
      marketing,
      timestamp: Date.now()
    };

    localStorage.setItem('cookie-consent', JSON.stringify(consentData));
    updateConsentMode(analytics, marketing);
    setShowBanner(false);
  };

  const acceptAll = () => {
    saveConsent(true, true);
  };

  const rejectAll = () => {
    saveConsent(false, false);
  };

  const saveCustomPreferences = () => {
    saveConsent(preferences.analytics, preferences.marketing);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center pointer-events-none" style={{ willChange: 'transform' }}>
      <div className="pointer-events-auto w-full max-w-4xl mx-4 mb-6 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden" style={{ transform: 'translateZ(0)' }}>
        {!showDetails ? (
          <div className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Cookie className="w-6 h-6 text-blue-600" />
              </div>

              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Respect de votre vie privée
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                  Nous utilisons des cookies pour améliorer votre expérience de navigation, analyser le trafic du site et mesurer l'efficacité de nos campagnes marketing.
                  En cliquant sur "Tout accepter", vous consentez à l'utilisation de TOUS les cookies.
                  Vous pouvez également personnaliser vos préférences.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={acceptAll}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Tout accepter
                  </button>
                  <button
                    onClick={rejectAll}
                    className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
                  >
                    Tout refuser
                  </button>
                  <button
                    onClick={() => setShowDetails(true)}
                    className="px-6 py-2.5 bg-white hover:bg-gray-50 text-gray-800 font-medium rounded-lg border-2 border-gray-300 transition-colors"
                  >
                    Personnaliser
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-gray-900">
                  Paramètres des cookies
                </h3>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">
                    Cookies essentiels
                  </h4>
                  <p className="text-sm text-gray-600">
                    Ces cookies sont nécessaires au fonctionnement du site et ne peuvent pas être désactivés.
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Toujours actif
                  </span>
                </div>
              </div>

              <div className="flex items-start justify-between p-4 border-2 border-gray-200 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">
                    Cookies analytiques
                  </h4>
                  <p className="text-sm text-gray-600">
                    Ces cookies nous permettent de mesurer et d'améliorer les performances de notre site.
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button
                    onClick={() => setPreferences(prev => ({ ...prev, analytics: !prev.analytics }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences.analytics ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        preferences.analytics ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-start justify-between p-4 border-2 border-gray-200 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">
                    Cookies marketing
                  </h4>
                  <p className="text-sm text-gray-600">
                    Ces cookies sont utilisés pour vous proposer des publicités pertinentes et mesurer l'efficacité de nos campagnes.
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button
                    onClick={() => setPreferences(prev => ({ ...prev, marketing: !prev.marketing }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences.marketing ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        preferences.marketing ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={saveCustomPreferences}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Enregistrer mes préférences
              </button>
              <button
                onClick={acceptAll}
                className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
              >
                Tout accepter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsentBanner;
