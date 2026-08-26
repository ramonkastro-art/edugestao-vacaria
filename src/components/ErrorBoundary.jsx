import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Erro não tratado na interface:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
        <section role="alert" className="w-full max-w-md bg-white border border-red-100 rounded-3xl shadow-sm p-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
            <AlertTriangle size={22} />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">O sistema encontrou um erro</h1>
          <p className="text-sm text-slate-500 mt-2">Atualize a página. Se o problema continuar, informe o horário e a ação que estava sendo executada à equipe responsável.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 text-white text-sm font-medium hover:bg-slate-800 active:scale-95 transition-all">
            <RefreshCw size={15} /> Atualizar página
          </button>
        </section>
      </main>
    )
  }
}
