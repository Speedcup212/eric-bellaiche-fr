import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; message: string; }

export default class PortalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : 'Erreur inattendue' };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Portal rendering error', error, info);
  }

  private reload = () => {
    window.location.reload();
  };

  private returnHome = () => {
    window.location.assign('/espace-client');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#edf3fa] px-4 py-10">
        <div className="w-full max-w-xl rounded-[28px] border border-red-200 bg-white p-7 shadow-xl shadow-slate-900/10 sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">Incident d’affichage</p>
          <h1 className="mt-3 text-2xl font-semibold text-[#0b1f3a]">La page n’a pas pu s’afficher correctement.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Vos informations déjà enregistrées ne sont pas perdues. Actualisez la page. Si le problème persiste, revenez à l’accueil de votre dossier.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={this.reload} className="rounded-xl bg-[#0b1f3a] px-5 py-3 text-sm font-semibold text-white">Actualiser la page</button>
            <button type="button" onClick={this.returnHome} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">Revenir au dossier</button>
          </div>
          {import.meta.env.DEV && this.state.message && <pre className="mt-6 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-200">{this.state.message}</pre>}
        </div>
      </div>
    );
  }
}
