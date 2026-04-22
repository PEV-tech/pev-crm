'use client'

/**
 * Paramètres — shell de la page.
 *
 * Refonte 2026-04-22 (audit UX Maxine) :
 *   - Regroupement en 5 sections (au lieu de 8 onglets à plat)
 *   - Chaque section a une intro claire (ce qui est configuré, quand ça s'applique)
 *   - Logique extraite par onglet dans ./_tabs/
 *   - Ancien onglet "Grilles" (bug : requête sur taux_produit_compagnie avec colonnes
 *     de grilles_frais) remplacé par la nouvelle section Catalogue.
 */

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Users, BookOpen, Percent, Mail, Shield } from 'lucide-react'
import { useUser, useRole } from '@/hooks/use-user'
import { useToast } from '@/components/ui/toast'
import { EquipeSection } from './_tabs/equipe-section'
import { CatalogueSection } from './_tabs/catalogue-section'
import { RemunerationSection } from './_tabs/remuneration-section'
import { CommunicationSection } from './_tabs/communication-section'
import { AdminSection } from './_tabs/admin-section'

export default function ParametresPage() {
  const role = useRole()
  const { consultant } = useUser()
  const isManager = role === 'manager' || role === 'back_office'
  const { showToast, ToastContainer } = useToast()

  return (
    <div className="space-y-6">
      {ToastContainer}

      <header>
        <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-600 mt-1">
          {isManager
            ? 'Administration de l\'application — tout ce qui est configurable est ici.'
            : 'Consultation de la configuration (lecture seule).'}
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="equipe" className="space-y-6">
            <TabsList
              className={`grid w-full ${role === 'manager' ? 'grid-cols-5' : 'grid-cols-4'}`}
            >
              <TabsTrigger value="equipe" className="flex items-center gap-2">
                <Users size={16} />
                <span className="hidden sm:inline">Équipe</span>
              </TabsTrigger>
              <TabsTrigger value="catalogue" className="flex items-center gap-2">
                <BookOpen size={16} />
                <span className="hidden sm:inline">Catalogue</span>
              </TabsTrigger>
              <TabsTrigger value="remuneration" className="flex items-center gap-2">
                <Percent size={16} />
                <span className="hidden sm:inline">Rémunération</span>
              </TabsTrigger>
              <TabsTrigger value="communication" className="flex items-center gap-2">
                <Mail size={16} />
                <span className="hidden sm:inline">Communication</span>
              </TabsTrigger>
              {role === 'manager' && (
                <TabsTrigger value="admin" className="flex items-center gap-2">
                  <Shield size={16} />
                  <span className="hidden sm:inline">Administration</span>
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="equipe">
              <EquipeSection isManager={isManager} showToast={showToast} />
            </TabsContent>

            <TabsContent value="catalogue">
              <CatalogueSection isManager={isManager} showToast={showToast} />
            </TabsContent>

            <TabsContent value="remuneration">
              <RemunerationSection isManager={isManager} showToast={showToast} />
            </TabsContent>

            <TabsContent value="communication">
              <CommunicationSection
                currentConsultantId={consultant?.id ?? null}
                isManager={isManager}
              />
            </TabsContent>

            {role === 'manager' && (
              <TabsContent value="admin">
                <AdminSection showToast={showToast} />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
