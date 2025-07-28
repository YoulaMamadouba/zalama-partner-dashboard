'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import PaymentResultModal from '@/components/dashboard/PaymentResultModal';

import { ArcElement, BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip } from 'chart.js';
import { useEffect, useState } from 'react';
import { Bar, Pie } from 'react-chartjs-2';

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
  pay_id?: string;
  employee: {
    nom: string;
    prenom: string;
    salaire_net: number;
  };
  demande_avance?: {
    montant_demande: number;
    date_validation: string;
  };
  tous_remboursements?: {
    id: string;
    montant_total_remboursement: number;
    statut: string;
    date_creation: string;
    demande_avance?: {
      montant_demande: number;
      date_validation: string;
    };
  }[];
};

export default function RemboursementsPage() {
  const { session, loading } = useAuth();
  const [remboursements, setRemboursements] = useState<Remboursement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalAttente, setTotalAttente] = useState(0);
  const [paying, setPaying] = useState(false);
  const [selectedRemboursement, setSelectedRemboursement] = useState<Remboursement | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentResultModal, setShowPaymentResultModal] = useState(false);
  const [currentPayId, setCurrentPayId] = useState<string | undefined>();
  const router = useRouter();

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
        id, employe_id, partenaire_id, demande_avance_id, montant_transaction, frais_service, montant_total_remboursement, date_limite_remboursement, statut, date_remboursement_effectue, pay_id,
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
    
    // Récupérer tous les remboursements de chaque employé pour calculer le salaire restant
    const remboursementsAvecTousRemboursements = await Promise.all(
      remboursementsAvecDemandes.map(async (r: any) => {
        try {
          // Récupérer tous les remboursements de cet employé (tous statuts)
          const { data: tousRemboursements, error: tousRemboursementsError } = await supabase
            .from('remboursements')
            .select(`
              id, montant_total_remboursement, statut, date_creation,
              demande_avance:demande_avance_id (montant_demande, date_validation)
            `)
            .eq('employe_id', r.employe_id)
            .order('date_creation', { ascending: true });
          
          if (tousRemboursementsError) {
            console.error('Erreur récupération tous remboursements:', tousRemboursementsError);
            return {
              ...r,
              tous_remboursements: []
            };
          }
          
          return {
            ...r,
            tous_remboursements: tousRemboursements || []
          };
        } catch (error) {
          console.error('Erreur lors de la récupération de tous les remboursements:', error);
          return {
            ...r,
            tous_remboursements: []
          };
        }
      })
    );
    
    console.log('Remboursements avec tous remboursements:', remboursementsAvecTousRemboursements);
    setRemboursements(remboursementsAvecTousRemboursements);
    
    // Calcul du total en attente (seulement les remboursements en attente)
    const total = (remboursementsAvecTousRemboursements || [])
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

  // Vérifier s'il y a un paiement en attente de vérification
  useEffect(() => {
    const checkPendingPayment = () => {
      const pendingPayId = sessionStorage.getItem('pendingPaymentCheck');
      const urlParams = new URLSearchParams(window.location.search);
      const shouldCheckPayment = urlParams.get('check_payment');
      const payIdFromUrl = urlParams.get('pay_id');
      
      console.log('Vérification des paramètres:', { 
        pendingPayId, 
        shouldCheckPayment, 
        payIdFromUrl,
        isLoading 
      });
      
      // Priorité au pay_id de l'URL, puis au sessionStorage
      const payIdToCheck = payIdFromUrl || pendingPayId;
      
      if (payIdToCheck && shouldCheckPayment) {
        console.log('✅ Vérification automatique du paiement:', payIdToCheck);
        setCurrentPayId(payIdToCheck);
        setShowPaymentResultModal(true);
        
        // Nettoyer le sessionStorage et l'URL
        sessionStorage.removeItem('pendingPaymentCheck');
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        console.log('❌ Pas de vérification automatique:', { 
          payIdToCheck, 
          shouldCheckPayment 
        });
      }
    };

    // Vérifier après le chargement de la page
    if (!isLoading) {
      console.log('🔍 Vérification après chargement...');
      checkPendingPayment();
    }
  }, [isLoading]);

  // Action "Payer" un remboursement via l'API simplifiée
  const handlePayer = async (id: string) => {
    setPaying(true);
    try {
      const response = await fetch('https://admin.zalamasas.com/api/remboursements/simple-paiement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remboursement_id: id })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Paiement initié:', data);
        // Rediriger vers l'interface de paiement de Lengo Pay
        if (data.payment_url) {
        window.open(data.payment_url, '_blank');
        } else {
          console.error('URL de paiement manquante');
          alert('Erreur: URL de paiement manquante');
        }
        await fetchRemboursements();
      } else {
        console.error('Erreur lors du paiement:', data.error);
        alert(`Erreur: ${data.error}`);
      }
    } catch (error) {
      console.error('Erreur lors du paiement:', error);
      alert('Erreur lors du paiement');
    } finally {
      setPaying(false);
    }
  };

  // Action "Payer tous" via l'API simplifiée
  const handlePayerTous = async () => {
    if (!session?.partner?.id) return;
    
    setPaying(true);
    try {
      const response = await fetch('https://admin.zalamasas.com/api/remboursements/simple-paiement-lot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partenaire_id: session.partner.id })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Paiement en lot initié:', data);
        // Rediriger vers l'interface de paiement de Lengo Pay
        if (data.payment_url) {
        window.open(data.payment_url, '_blank');
        } else {
          console.error('URL de paiement manquante');
          alert('Erreur: URL de paiement manquante');
        }
        await fetchRemboursements();
      } else {
        console.error('Erreur lors du paiement en lot:', data.error);
        alert(`Erreur: ${data.error}`);
      }
    } catch (error) {
      console.error('Erreur lors du paiement en lot:', error);
      alert('Erreur lors du paiement en lot');
    } finally {
      setPaying(false);
    }
  };

  // Handler pour ouvrir la modal de détail
  const handleViewDetail = (remb: Remboursement) => {
    setSelectedRemboursement(remb);
    setShowDetailModal(true);
  };

  // Handler pour fermer la modal de détail
  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedRemboursement(null);
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

  // Fonction pour calculer le salaire restant de l'employé en fonction de la position du remboursement
  const calculateSalaireRestant = (remboursement: Remboursement) => {
    const salaireNet = Number(remboursement.employee?.salaire_net || 0);
    
    // Trouver la position de ce remboursement dans la liste chronologique
    const tousRemboursements = remboursement.tous_remboursements || [];
    const positionActuelle = tousRemboursements.findIndex(remb => remb.id === remboursement.id);
    
    // Si ce remboursement n'est pas trouvé, retourner le salaire net
    if (positionActuelle === -1) {
      return salaireNet;
    }
    
    // Calculer le salaire restant en déduisant seulement les remboursements jusqu'à cette position
    let salaireRestant = salaireNet;
    
    // Déduire les remboursements jusqu'à la position actuelle (inclusive)
    for (let i = 0; i <= positionActuelle; i++) {
      const remb = tousRemboursements[i];
      const montantRemboursement = Number(remb.montant_total_remboursement || 0);
      salaireRestant = Math.max(0, salaireRestant - montantRemboursement);
    }
    
    return salaireRestant;
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

  // Total des remboursements en attente seulement
  const totalRemboursements = remboursements
    .filter(r => r.statut === 'EN_ATTENTE')
    .reduce((sum, r) => sum + Number(r.montant_total_remboursement), 0);

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
        <Button onClick={() => handlePayerTous()} disabled={paying || totalAttente === 0}>
          {paying ? 'Paiement...' : 'PAYER TOUS'}
        </Button>
      </div>

      <div className="bg-[var(--zalama-card)] border rounded-xl shadow p-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="text-lg font-semibold">Total des remboursements en attente :</div>
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
              <th className="px-4 py-3 text-left font-semibold border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRemboursements.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-8 text-gray-400">Aucun remboursement trouvé.</td>
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
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {r.statut === 'EN_ATTENTE' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedRemboursement(r);
                          setShowPaymentModal(true);
                        }}
                        disabled={paying}
                        className="bg-orange-600 hover:bg-orange-700 text-white text-xs"
                      >
                        💳 Payer
                      </Button>
                    )}
                    {r.pay_id && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCurrentPayId(r.pay_id);
                            setShowPaymentResultModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 text-xs"
                        >
                          🔍 Vérifier
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            router.push(`/dashboard/remboursements/detail/${r.pay_id}`);
                          }}
                          className="text-green-600 hover:text-green-700 text-xs"
                        >
                          📋 Détails
                        </Button>
                      </>
                    )}
                  </div>
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
              <div><span className="font-semibold">Total remboursements :</span> <span className="font-semibold">{selectedRemboursement.tous_remboursements?.length || 0} remboursement(s)</span></div>
              <div><span className="font-semibold">Montant total des remboursements :</span> <span className="font-semibold">{gnfFormatter((selectedRemboursement.tous_remboursements || []).reduce((sum, r) => sum + Number(r.montant_total_remboursement || 0), 0))}</span></div>
              
              {/* Historique des remboursements */}
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Historique des remboursements :</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selectedRemboursement.tous_remboursements?.map((remb, index) => {
                    // Calculer le salaire restant après ce remboursement
                    let salaireRestantApres = Number(selectedRemboursement.employee?.salaire_net || 0);
                    for (let i = 0; i <= index; i++) {
                      const rembCourant = selectedRemboursement.tous_remboursements![i];
                      const montantRemboursement = Number(rembCourant.montant_total_remboursement || 0);
                      salaireRestantApres = Math.max(0, salaireRestantApres - montantRemboursement);
                    }
                    
                    return (
                      <div key={index} className="text-sm bg-gray-50 dark:bg-gray-800 p-2 rounded">
                        <div className="flex justify-between">
                          <span>Remboursement #{index + 1}</span>
                          <span className="font-semibold">{gnfFormatter(Number(remb.montant_total_remboursement || 0))}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{remb.statut}</span>
                          <span>{remb.date_creation ? new Date(remb.date_creation).toLocaleDateString('fr-FR') : '-'}</span>
                        </div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                          Salaire restant après : {gnfFormatter(salaireRestantApres)}
                        </div>
                      </div>
                    );
                  }) || <div className="text-gray-500 text-sm">Aucun remboursement trouvé</div>}
                </div>
              </div>
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

      {/* Modal de paiement */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Paiement via Orange Money (Lengopay)</DialogTitle>
            <DialogDescription>
              Confirmez le paiement via Lengopay. Les champs sont préremplis et non modifiables.
            </DialogDescription>
          </DialogHeader>
          {selectedRemboursement && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Détails du paiement</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Employé :</span> {selectedRemboursement.employee?.nom} {selectedRemboursement.employee?.prenom}</div>
                  <div><span className="font-medium">Montant à rembourser :</span> <span className="font-semibold text-red-600">{gnfFormatter(calculateRemboursementDu(getMontantDemande(selectedRemboursement)))}</span></div>
                  <div><span className="font-medium">Date limite :</span> {new Date(selectedRemboursement.date_limite_remboursement).toLocaleDateString('fr-FR')}</div>
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 text-blue-800 dark:text-blue-200">Informations de paiement</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Mode de paiement :</span> Orange Money via Lengopay</div>
                  <div><span className="font-medium">Sécurité :</span> Transaction sécurisée SSL</div>
                  <div><span className="font-medium">Confirmation :</span> Reçu électronique automatique</div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => {
                if (selectedRemboursement) {
                  handlePayer(selectedRemboursement.id);
                  setShowPaymentModal(false);
                }
              }}
              disabled={paying}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {paying ? 'Traitement...' : 'Confirmer le paiement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de résultat de paiement */}
      <PaymentResultModal
        isOpen={showPaymentResultModal}
        onClose={() => {
          setShowPaymentResultModal(false);
          setCurrentPayId(undefined);
        }}
        payId={currentPayId}
        onRefresh={fetchRemboursements}
      />


    </div>
  );
}
