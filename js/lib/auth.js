// Autenticação por link mágico (magic link).
import { supabase } from './supabase-client.js';

/** Sessão atual (ou null). */
export async function sessaoAtual() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/** Usuário logado (ou null). */
export async function usuarioAtual() {
  const s = await sessaoAtual();
  return s?.user ?? null;
}

/**
 * Envia o link mágico para o e-mail. Ao clicar no link, a pessoa volta para
 * ESTA mesma página já logada.
 */
export async function enviarLinkMagico(email) {
  const redirect = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirect },
  });
  if (error) throw error;
}

/** Sai da conta. */
export async function sair() {
  await supabase.auth.signOut();
}

/** Avisa sempre que o login/logout mudar. Retorna função para cancelar. */
export function aoMudarAuth(callback) {
  const { data } = supabase.auth.onAuthStateChange((_evt, session) => callback(session));
  return () => data.subscription.unsubscribe();
}
