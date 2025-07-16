'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, CheckCircle2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type Remboursement = {
  id: string;
  employe_id: string;
  partenaire_id: string;
  demande_avance_id: string;
  montant_transaction: number;
  frais_service: number;
  montant_total_remboursement: number;
  date_limite_remboursement: string;
  statut: string;
  date_remboursement_effectue: string | null;
  employee: {
    nom: string;
    prenom: string;
    salaire_net: number;
  };
  demande_avance?: {
    montant_demande: number;
    date_validation: string;
  };
};

export default function RemboursementsPage() {
  const supabase = createClientComponentClient();
  const { session, loading } = useAuth();
  const [remboursements, setRemboursements] = useState<Remboursement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalAttente, setTotalAttente] = useState(0);
  const [paying, setPaying] = useState(false);
  const [selectedRemboursement, setSelectedRemboursement] = useState<Remboursement | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAll, setPayAll] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(remboursements.length / itemsPerPage);
  const paginatedRemboursements = remboursements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Fonction de récupération des remboursements
  const fetchRemboursements = async () => {
    if (!session?.partner) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('remboursements')
      .select(`
        id, employe_id, partenaire_id, demande_avance_id, montant_transaction, frais_service, montant_total_remboursement, date_limite_remboursement, statut, date_remboursement_effectue,
        employee:employe_id (nom, prenom, salaire_net)
      `)
      .eq('partenaire_id', session.partner.id)
      .order('date_limite_remboursement', { ascending: true });
    if (error) {
      console.error('Erreur récupération remboursements:', error);
    }
    
    // Récupérer les données de demande d'avance pour chaque remboursement
    const remboursementsAvecDemandes = await Promise.all(
      (data || []).map(async (r: any) => {
        try {
          const { data: demandeData, error: demandeError } = await supabase
            .from('salary_advance_requests')
            .select('montant_demande, date_validation')
            .eq('id', r.demande_avance_id)
            .single();
          
          if (demandeError) {
            console.error('Erreur récupération demande avance:', demandeError);
            return {
              ...r,
              employee: Array.isArray(r.employee) ? r.employee[0] : r.employee,
              demande_avance: null
            };
          }
          
          return {
            ...r,
            employee: Array.isArray(r.employee) ? r.employee[0] : r.employee,
            demande_avance: demandeData
          };
        } catch (error) {
          console.error('Erreur lors de la récupération de la demande:', error);
          return {
            ...r,
            employee: Array.isArray(r.employee) ? r.employee[0] : r.employee,
            demande_avance: null
          };
        }
      })
    );
    
    console.log('Remboursements avec demandes:', remboursementsAvecDemandes);
    setRemboursements(remboursementsAvecDemandes);
    // Calcul du total en attente
    const total = (remboursementsAvecDemandes || [])
      .filter((r: any) => r.statut === 'EN_ATTENTE')
      .reduce((sum: number, r: any) => sum + Number(r.montant_total_remboursement), 0);
    setTotalAttente(total);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!loading && session?.partner) {
      console.log('Session:', session);
      fetchRemboursements();
    }
  }, [loading, session?.partner]);

  // Action "Payer" un remboursement
  const handlePayer = async (id: string) => {
    setPaying(true);
    await supabase
      .from('remboursements')
      .update({ statut: 'PAYE', date_remboursement_effectue: new Date().toISOString() })
      .eq('id', id);
    await fetchRemboursements();
    setPaying(false);
  };

  // Action "Payer tous"
  const handlePayerTous = async () => {
    setPaying(true);
    const ids = remboursements.filter(r => r.statut === 'EN_ATTENTE').map(r => r.id);
    if (ids.length > 0) {
      await supabase
        .from('remboursements')
        .update({ statut: 'PAYE', date_remboursement_effectue: new Date().toISOString() })
        .in('id', ids);
      await fetchRemboursements();
    }
    setPaying(false);
  };

  // Handler pour ouvrir la modal de détail
  const handleViewDetail = (remb: Remboursement) => {
    setSelectedRemboursement(remb);
    setShowDetailModal(true);
  };

  // Handler pour ouvrir la modal de paiement (individuel ou total)
  const handleOpenPayModal = (remb?: Remboursement) => {
    if (remb) {
      setSelectedRemboursement(remb);
      setPayAll(false);
    } else {
      setSelectedRemboursement(null);
      setPayAll(true);
    }
    setShowPayModal(true);
  };

  // Handler pour fermer les modals
  const handleCloseModal = () => {
    setShowDetailModal(false);
    setShowPayModal(false);
    setSelectedRemboursement(null);
    setPayAll(false);
  };

  // Données pour les graphiques
  const stats = remboursements.reduce((acc, r) => {
    acc[r.statut] = (acc[r.statut] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const employeStats = remboursements.reduce((acc, r) => {
    const nom = r.employee?.nom + ' ' + r.employee?.prenom;
    acc[nom] = (acc[nom] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Fonction utilitaire pour formater en GNF
  const gnfFormatter = (value: number) => `${value.toLocaleString()} GNF`;

  // Fonction pour calculer le salaire restant de l'employé après la demande d'avance
  const calculateSalaireRestant = (remboursement: Remboursement) => {
    const salaireNet = Number(remboursement.employee?.salaire_net || 0);
    const montantDemande = Number(remboursement.demande_avance?.montant_demande || 0);
    return Math.max(0, salaireNet - montantDemande);
  };

  // Fonction pour calculer les frais de service (6,5%)
  const calculateFraisService = (montantDemande: number) => {
    return montantDemande * 0.065; // 6,5%
  };

  // Fonction pour calculer le montant reçu (avance - frais)
  const calculateMontantRecu = (montantDemande: number, fraisService: number) => {
    return montantDemande - fraisService;
  };

  // Fonction pour calculer le remboursement dû à ZaLaMa
  const calculateRemboursementDu = (montantDemande: number) => {
    return montantDemande; // Le remboursement dû = montant demandé
  };

  // Fonction pour obtenir le montant demandé en toute sécurité
  const getMontantDemande = (remboursement: Remboursement) => {
    return Number(remboursement.demande_avance?.montant_demande || 0);
  };

  // Correction : total de tous les remboursements (pas seulement en attente)
  const totalRemboursements = remboursements.reduce((sum, r) => sum + Number(r.montant_total_remboursement), 0);

  // Skeleton
  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-64 w-full mb-4" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Remboursements</h1>
        <Button onClick={() => handleOpenPayModal()} disabled={paying || totalAttente === 0}>
          {paying ? 'Paiement...' : 'PAYER TOUS'}
        </Button>
      </div>

      <div className="bg-[var(--zalama-card)] border rounded-xl shadow p-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="text-lg font-semibold">Total des remboursements :</div>
        <div className="text-2xl font-bold text-orange-600">{gnfFormatter(totalRemboursements)}</div>
      </div>

      {/* Liste des remboursements */}
      <div className="bg-[var(--zalama-card)] border rounded-xl shadow p-0 overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-[var(--zalama-card)]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold border-b">Employé</th>
              <th className="px-4 py-3 text-left font-semibold border-b">Salaire net (GNF)</th>
              <th className="px-4 py-3 text-left font-semibold border-b">Montant demandé (avance)</th>
              <th className="px-4 py-3 text-left font-semibold border-b">Frais service (6,5%)</th>
              <th className="px-4 py-3 text-left font-semibold border-b">Montant reçu (avance)</th>
              <th className="px-4 py-3 text-left font-semibold border-b">Remboursement dû à ZaLaMa</th>
              <th className="px-4 py-3 text-left font-semibold border-b">Salaire restant</th>
              <th className="px-4 py-3 text-left font-semibold border-b">Date de l'avance</th>
              <th className="px-4 py-3 text-left font-semibold border-b">Statut</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRemboursements.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-gray-400">Aucun remboursement trouvé.</td>
              </tr>
            )}
            {paginatedRemboursements.map((r, idx) => (
              <tr key={r.id} className={
                `transition-colors ${idx % 2 === 0 ? 'bg-white/60 dark:bg-white/5' : 'bg-gray-50 dark:bg-gray-900/10'} hover:bg-blue-50 dark:hover:bg-blue-900/10 border-b last:border-b-0`
              }>
                <td className="px-4 py-3 whitespace-nowrap">{r.employee?.nom} {r.employee?.prenom}</td>
                <td className="px-4 py-3">{gnfFormatter(Number(r.employee?.salaire_net || 0))}</td>
                <td className="px-4 py-3">{gnfFormatter(getMontantDemande(r))}</td>
                <td className="px-4 py-3">{gnfFormatter(calculateFraisService(getMontantDemande(r)))}</td>
                <td className="px-4 py-3">{gnfFormatter(calculateMontantRecu(getMontantDemande(r), calculateFraisService(getMontantDemande(r))))}</td>
                <td className="px-4 py-3 font-semibold text-red-600 dark:text-red-400">{gnfFormatter(calculateRemboursementDu(getMontantDemande(r)))}</td>
                <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{gnfFormatter(calculateSalaireRestant(r))}</td>
                <td className="px-4 py-3">{r.demande_avance?.date_validation ? new Date(r.demande_avance.date_validation).toLocaleDateString('fr-FR') : '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-semibold
                    ${r.statut === 'PAYE' ? 'bg-green-100 text-green-700' :
                      r.statut === 'EN_ATTENTE' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'}`}>
                    {r.statut}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-4">
          <button
            className="px-3 py-1 rounded border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-50"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Précédent
          </button>
          <span className="text-sm font-medium">
            Page {currentPage} / {totalPages}
          </span>
          <button
            className="px-3 py-1 rounded border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-50"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Suivant
          </button>
        </div>
      )}

      {/* Graphiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-[var(--zalama-card)] border rounded-xl shadow p-6">
          <h2 className="font-semibold mb-2">Répartition par statut</h2>
          <Pie
            data={{
              labels: Object.keys(stats),
              datasets: [{
                data: Object.values(stats),
                backgroundColor: ['#fbbf24', '#34d399', '#a1a1aa', '#f87171'],
              }]
            }}
          />
        </div>
        <div className="bg-[var(--zalama-card)] border rounded-xl shadow p-6">
          <h2 className="font-semibold mb-2">Répartition par employé</h2>
          <Bar
            data={{
              labels: Object.keys(employeStats),
              datasets: [{
                label: 'Nombre de remboursements',
                data: Object.values(employeStats),
                backgroundColor: '#6366f1',
              }]
            }}
            options={{
              indexAxis: 'y' as const,
              plugins: { legend: { display: false } }
            }}
          />
        </div>
      </div>

      {/* Modal de détail */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Détail du remboursement</DialogTitle>
            <DialogDescription>
              Informations détaillées du remboursement sélectionné.
            </DialogDescription>
          </DialogHeader>
          {selectedRemboursement && (
            <div className="space-y-3">
              <div><span className="font-semibold">Employé :</span> <span className="text-gray-800 dark:text-gray-200">{selectedRemboursement.employee?.nom} {selectedRemboursement.employee?.prenom}</span></div>
              <div><span className="font-semibold">Salaire net :</span> <span className="font-semibold">{gnfFormatter(Number(selectedRemboursement.employee?.salaire_net || 0))}</span></div>
              <div><span className="font-semibold">Montant demandé :</span> <span className="font-semibold">{gnfFormatter(getMontantDemande(selectedRemboursement))}</span></div>
              <div><span className="font-semibold">Frais de service (6,5%) :</span> <span className="font-semibold">{gnfFormatter(calculateFraisService(getMontantDemande(selectedRemboursement)))}</span></div>
              <div><span className="font-semibold">Montant reçu :</span> <span className="font-semibold">{gnfFormatter(calculateMontantRecu(getMontantDemande(selectedRemboursement), calculateFraisService(getMontantDemande(selectedRemboursement))))}</span></div>
              <div><span className="font-semibold text-red-600 dark:text-red-400">Remboursement dû à ZaLaMa :</span> <span className="text-red-600 dark:text-red-400 font-semibold">{gnfFormatter(calculateRemboursementDu(getMontantDemande(selectedRemboursement)))}</span></div>
              <div><span className="font-semibold text-emerald-600 dark:text-emerald-400">Salaire restant :</span> <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{gnfFormatter(calculateSalaireRestant(selectedRemboursement))}</span></div>
              <div><span className="font-semibold">Date de l'avance :</span> <span>{selectedRemboursement.demande_avance?.date_validation ? new Date(selectedRemboursement.demande_avance.date_validation).toLocaleDateString('fr-FR') : '-'}</span></div>
              <div><span className="font-semibold">Date limite remboursement :</span> <span>{new Date(selectedRemboursement.date_limite_remboursement).toLocaleDateString('fr-FR')}</span></div>
              <div><span className="font-semibold">Statut :</span> <span className={`px-2 py-1 rounded text-xs font-semibold
                ${selectedRemboursement.statut === 'PAYE' ? 'bg-green-100 text-green-700' :
                  selectedRemboursement.statut === 'EN_ATTENTE' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'}`}>
                {selectedRemboursement.statut}
              </span></div>
              <div><span className="font-semibold">Date paiement :</span> <span>{selectedRemboursement.date_remboursement_effectue ? new Date(selectedRemboursement.date_remboursement_effectue).toLocaleDateString('fr-FR') : '-'}</span></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de paiement (individuel ou total) */}
      <Dialog open={showPayModal} onOpenChange={setShowPayModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Paiement via Orange Money (Lengopay)</DialogTitle>
            <DialogDescription>
              Confirmez le paiement via Lengopay. Les champs sont préremplis et non modifiables.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Montant à payer</label>
              <Input value={payAll ? gnfFormatter(totalRemboursements) : gnfFormatter(Number(selectedRemboursement?.montant_total_remboursement || 0))} readOnly disabled />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Numéro Orange Money</label>
              <Input value={session?.partner?.telephone || ''} readOnly disabled />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Service</label>
              <Input value="Lengopay (Orange Money)" readOnly disabled />
            </div>
            {/* Ajouter d'autres champs si besoin */}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>Annuler</Button>
            <Button disabled>{payAll ? 'Payer le total' : 'Payer ce remboursement'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
