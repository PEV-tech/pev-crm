import type { ReactNode } from 'react'

/**
 * Layout scopé aux routes publiques `/kyc/*` (token client non authentifié).
 *
 * Retour Maxine 2026-04-21 v2 : la charte doit porter la marque PEV
 * (plus ton violet, plus la typographie, plus le logo...). On injecte
 * ici la police officielle du site PEV — Raleway — via un `<link>`
 * Google Fonts runtime, et on tinte le fond en lavande très pâle
 * (#F8EFFF, palette officielle PEV). Le dashboard interne reste
 * strictement inchangé (il n'est PAS inclus dans ce layout).
 *
 * Pourquoi pas `next/font/google` : le build Vercel passe, mais on
 * préfère un <link> runtime pour éviter tout échec de build si Google
 * Fonts est inaccessible pendant la compilation (sandbox, firewall, etc.).
 * Le coût perf est marginal — Raleway est hébergée sur le CDN Google,
 * preload + font-display: swap suffit.
 */

export default function KycPublicLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <>
      {/* Preconnect + stylesheet Raleway 300..800 — couvre body/bold/extrabold
          utilisés dans PevBrandHeader + hero + formulaires. */}
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700;800&display=swap"
      />
      <div
        className="pev-public-portal min-h-screen"
        style={{
          fontFamily:
            "'Raleway', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          // Fond blanc en haut → lavande très discrète en bas (#F8EFFF
          // est le pale accent officiel PEV). Rend l'arrière-plan
          // vivant sans gêner la lisibilité des cards blanches.
          background:
            'linear-gradient(180deg, #ffffff 0%, #ffffff 45%, #F8EFFF 100%)',
        }}
      >
        {children}
      </div>
    </>
  )
}
