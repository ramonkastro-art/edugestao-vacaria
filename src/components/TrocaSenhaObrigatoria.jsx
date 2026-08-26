import { useState } from 'react'
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function TrocaSenhaObrigatoria() {
  const { profile, trocarSenha, signOut } = useAuth()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setErro('')
    if (senha.length < 8) {
      setErro('A nova senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (senha !== confirmacao) {
      setErro('A confirmação não coincide com a nova senha.')
      return
    }

    setSalvando(true)
    const resultado = await trocarSenha(senha)
    setSalvando(false)
    if (resultado.error) setErro(resultado.error.message || 'Não foi possível atualizar a senha.')
  }

  return (
    <div className="min-h-screen brand-page-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#e4e9e2] shadow-[0_18px_45px_rgba(32,35,79,0.10)] p-7 sm:p-8">
        <div className="w-14 h-14 rounded-2xl brand-sidebar-mark flex items-center justify-center mb-5">
          <KeyRound size={25} className="text-white" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#0f789c]">Primeiro acesso</p>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">Crie sua senha pessoal</h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">Olá, {profile?.nome || 'diretora'}. Por segurança, troque a senha temporária antes de acessar o EduGestão.</p>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <label className="block"><span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nova senha</span><div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-[#0f789c]"><input type={mostrar ? 'text' : 'password'} autoComplete="new-password" value={senha} onChange={event => setSenha(event.target.value)} className="flex-1 bg-transparent text-sm outline-none" placeholder="Pelo menos 8 caracteres" /> <button type="button" onClick={() => setMostrar(valor => !valor)} className="text-slate-400 hover:text-[#0b5e7d]" aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}>{mostrar ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          <label className="block"><span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Confirmar nova senha</span><input type={mostrar ? 'text' : 'password'} autoComplete="new-password" value={confirmacao} onChange={event => setConfirmacao(event.target.value)} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#0f789c]" placeholder="Repita a nova senha" /></label>
          {erro && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">{erro}</p>}
          <button type="submit" disabled={salvando} className="w-full flex items-center justify-center gap-2 py-3 brand-primary text-white rounded-xl text-sm font-semibold disabled:opacity-50">{salvando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {salvando ? 'Atualizando…' : 'Salvar nova senha'}</button>
        </form>

        <button type="button" onClick={signOut} className="w-full mt-3 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-50"><LogOut size={15} /> Sair</button>
      </div>
    </div>
  )
}
