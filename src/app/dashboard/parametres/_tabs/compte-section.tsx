'use client'

/**
 * Section "Paramètres du compte"
 *
 * Retour Maxine (2026-04-22) : exposer dans Paramètres les fonctions
 * compte de base (identifiant, mot de passe, déconnexion) plutôt que
 * de les laisser uniquement cachées dans le header / sidebar.
 */

// sanity test placeholder'use client'

/**
 * Section "Paramètres du compte"
 *
 * Retour Maxine (2026-04-22) : exposer dans Paramètres les fonctions
 * compte de base (identifiant, mot de passe, déconnexion) plutôt que
 * de les laisser uniquement cachées dans le header / sidebar.
 *
 * Trois cartes :
 *   1. Mon identité — email (identifiant), prénom/nom, rôle — lecture seule.
 *   2. Mot de passe — formulaire nouveau + confirmation, appelle
 *      `supabase.auth.updateUser({ password })`.
 *   3. Session — bouton « Se déconnecter » (signOut + push /login).
 *
 * Aucune dépendance RLS / DB supplémentaire : on utilise Supabase Auth
 * directement côté client + les infos déjà chargées via `useUser()`.
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  User,
  KeyRound,
  LogOut,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { type ShowToast } from './helpers'

interface Props {
  showToast: ShowToast
}

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  consultant: 'Consultant',
  back_office: 'Back Office',
}

export function CompteSection({ showToast }: Props) {
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])
  const { user, consultant } = useUser()

  // -----------------------------------------------------------
  // Changement de mot de passe
  // -----------------------------------------------------------
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [showNew, setShowNew] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)
  const [pwdLoading, setPwdLoading] = React.useState(false)
  const [pwdError, setPwdError] = React.useState<string | null>(null)

  const pwdTooShort = newPassword.length > 0 && newPassword.length < 8
  const pwdMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword
  const pwdValid =
    newPassword.length >= 8 && newPassword === confirmPassword

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPwdError(null)
    if (!pwdValid) return
    setPwdLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwdLoading(false)
    if (error) {
      setPwdError(error.message)
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    showToast('Votre mot de passe a été mis à jour.', 'success')
  }

  // -----------------------------------------------------------
  // Déconnexion
  // -----------------------------------------------------------
  const [logoutLoading, setLogoutLoading] = React.useState(false)
  const [confirmingLogout, setConfirmingLogout] = React.useState(false)

  async function handleLogout() {
    setLogoutLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  // -----------------------------------------------------------
  // Rendu
  // -----------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="rounded-lg border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-full bg-indigo-100 p-2 text-indigo-600">
            <User size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Paramètres du compte
            </h3>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              Vos informations de connexion et de session. Ces réglages sont
              personnels — ils ne concernent que votre propre accès au CRM.
            </p>
          </div>
        </div>
      </div>

      {/* Carte 1 : Mon identité */}
      <Card>
        <CardContent className="py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-lg bg-gray-100 p-2 text-gray-600">
              <User size={18} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">
                Mon identité
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Informations de base de votre compte. Pour les modifier,
                contactez votre manager.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoField
              label="Identifiant (email de connexion)"
              value={user?.email || '—'}
            />
            <InfoField
              label="Nom affiché"
              value={
                consultant
                  ? `${consultant.prenom} ${consultant.nom}`
                  : '—'
              }
            />
            <InfoField
              label="Rôle"
              value={
                consultant?.role
                  ? ROLE_LABELS[consultant.role] || consultant.role
                  : '—'
              }
            />
            <InfoField
              label="Statut"
              value={
                consultant?.actif === false
                  ? 'Inactif'
                  : 'Actif'
              }
              valueClass={
                consultant?.actif === false
                  ? 'text-red-700'
                  : 'text-green-700'
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Carte 2 : Mot de passe */}
      <Card>
        <CardContent className="py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-lg bg-amber-50 p-2 text-amber-700">
              <KeyRound size={18} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">
                Mot de passe
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Choisissez un mot de passe d&apos;au moins 8 caractères. Vous
                resterez connecté(e) sur cet appareil après le changement.
              </p>
            </div>
          </div>
          <form
            onSubmit={handleChangePassword}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl"
          >
            <PasswordField
              label="Nouveau mot de passe"
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggleShow={() => setShowNew((v) => !v)}
              autoComplete="new-password"
              error={
                pwdTooShort ? 'Au moins 8 caractères.' : null
              }
            />
            <PasswordField
              label="Confirmer le nouveau mot de passe"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirm}
              onToggleShow={() => setShowConfirm((v) => !v)}
              autoComplete="new-password"
              error={
                pwdMismatch ? 'Les deux mots de passe ne correspondent pas.' : null
              }
            />
            <div className="sm:col-span-2 flex items-center gap-3 mt-1">
              <Button
                type="submit"
                disabled={!pwdValid || pwdLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {pwdLoading ? 'Enregistrement…' : 'Mettre à jour le mot de passe'}
              </Button>
              {pwdError && (
                <span className="text-xs text-red-700 inline-flex items-center gap-1">
                  <AlertCircle size={13} /> {pwdError}
                </span>
              )}
              {pwdValid && !pwdError && !pwdLoading && (
                <span className="text-xs text-green-700 inline-flex items-center gap-1">
                  <CheckCircle2 size={13} /> Prêt à enregistrer
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Carte 3 : Session */}
      <Card>
        <CardContent className="py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-lg bg-gray-100 p-2 text-gray-600">
              <LogOut size={18} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900">
                Session
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Fermer votre session actuelle. Vous devrez ressaisir votre
                email et votre mot de passe pour vous reconnecter.
              </p>
            </div>
          </div>
          {!confirmingLogout ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingLogout(true)}
              className="inline-flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
            >
              <LogOut size={15} />
              Se déconnecter
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
              <span className="text-sm text-red-900">
                Confirmer la déconnexion ?
              </span>
              <div className="flex gap-2 sm:ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmingLogout(false)}
                  disabled={logoutLoading}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {logoutLoading ? 'Déconnexion…' : 'Oui, me déconnecter'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// -----------------------------------------------------------
// Sous-composants
// -----------------------------------------------------------

function InfoField({
  label,
  value,
  valueClass = '',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div
        className={`mt-1 text-sm font-medium text-gray-900 break-words ${valueClass}`}
      >
        {value}
      </div>
    </div>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  autoComplete?: string
  error: string | null
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 mb-1">
        {label}
      </span>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`w-full border rounded-md pl-3 pr-9 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 ${
            error ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
          aria-label={show ? 'Masquer' : 'Afficher'}
          tabIndex={-1}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && (
        <span className="text-[11px] text-red-700 mt-1 inline-block">
          {error}
        </span>
      )}
    </label>
  )
}
