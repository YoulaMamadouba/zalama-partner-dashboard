'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, CheckCircle, XCircle, Clock, User, Building, Calendar, DollarSign } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface RemboursementDetail {
  id: string;
  pay_id: string;
  montant_total_remboursement: number;
  statut: string;
  date_creation: string;
  date_remboursement_effectue: string | null;
  methode_remboursement: string;
  employe: {
    id: string;
    nom: string;
    prenom: string;
    telephone: string;
    salaire_net: number;
  };
  partenaire: {
    id: string;
    company_name: string;
    hr_email: string;
  };
  demande_avance?: {
    montant_demande: number;
    date_validation: string;
  };
  lengo_status?: {
    status: string;
    date: string;
    amount: number;
  };
}

export default function RemboursementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const [remboursement, setRemboursement] = useState<RemboursementDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const payId = decodeURIComponent(params.pay_id as string);

  useEffect(() => {
    const fetchRemboursementDetail = async () => {
      console.log('=== DÉBUT fetchRemboursementDetail ===');
      console.log('payId reçu:', payId);
      console.log('Type de payId:', typeof payId);
      
      if (!payId) {
        console.error('Pay ID manquant');
        setError('Pay ID manquant');
        return;
      }

      console.log('Récupération des détails pour pay_id:', payId);

      try {
        setIsLoading(true);
        console.log('Début de la requête Supabase...');
        
        // Test simple d'abord
        console.log('Test 1: Requête simple...');
        const { data: testData, error: testError } = await supabase
          .from('remboursements')
          .select('id, pay_id, statut')
          .eq('pay_id', payId)
          .single();
        
        console.log('Test 1 résultat:', { testData, testError });
        
        if (testError) {
          console.error('Erreur dans le test simple:', testError);
          throw new Error(`Test simple échoué: ${testError.message}`);
        }
        
        console.log('Test 1 réussi, requête complète...');
        
        // Utiliser directement Supabase côté client
        const { data: remboursement, error: remboursementError } = await supabase
          .from('remboursements')
          .select(`
            *,
            employe:employe_id (
              id,
              nom,
              prenom,
              telephone,
              salaire_net
            ),
            partenaire:partenaire_id (
              id,
              company_name,
              hr_email
            ),
            demande_avance:demande_avance_id (
              montant_demande,
              date_validation
            )
          `)
          .eq('pay_id', payId)
          .single();

        console.log('Résultat Supabase brut:', { remboursement, remboursementError });
        console.log('remboursementError type:', typeof remboursementError);
        console.log('remboursementError message:', remboursementError?.message);
        console.log('remboursementError details:', remboursementError?.details);

        if (remboursementError) {
          console.error('Erreur Supabase détectée:', remboursementError);
          // Fallback: utiliser les données du test simple
          console.log('Fallback vers les données du test simple...');
          const formattedRemboursement = {
            id: testData.id,
            pay_id: testData.pay_id,
            montant_total_remboursement: 0,
            montant_transaction: 0,
            frais_service: 0,
            statut: testData.statut,
            date_creation: new Date().toISOString(),
            date_remboursement_effectue: null,
            date_limite_remboursement: new Date().toISOString(),
            methode_remboursement: 'N/A',
            employe: null,
            partenaire: null,
            demande_avance: null
          };
          setRemboursement(formattedRemboursement as unknown as RemboursementDetail);
          return;
        }

        if (!remboursement) {
          console.error('Aucun remboursement trouvé');
          throw new Error('Remboursement non trouvé');
        }

        console.log('Remboursement trouvé:', remboursement);

        // Formater les données
        const formattedRemboursement = {
          id: remboursement.id,
          pay_id: remboursement.pay_id,
          montant_total_remboursement: remboursement.montant_total_remboursement,
          montant_transaction: remboursement.montant_transaction,
          frais_service: remboursement.frais_service,
          statut: remboursement.statut,
          date_creation: remboursement.date_creation,
          date_remboursement_effectue: remboursement.date_remboursement_effectue,
          date_limite_remboursement: remboursement.date_limite_remboursement,
          methode_remboursement: remboursement.methode_remboursement,
          employe: remboursement.employe,
          partenaire: remboursement.partenaire,
          demande_avance: remboursement.demande_avance
        };

        console.log('Données formatées:', formattedRemboursement);
        console.log('Mise à jour du state...');
        setRemboursement(formattedRemboursement);
        console.log('State mis à jour avec succès');
      } catch (err: any) {
        console.error('Erreur lors de la récupération:', err);
        console.error('Type d\'erreur:', typeof err);
        console.error('Message d\'erreur:', err.message);
        setError(err.message || 'Erreur lors de la récupération du remboursement');
      } finally {
        console.log('Fin du try/catch, isLoading = false');
        setIsLoading(false);
      }
    };

    console.log('Appel de fetchRemboursementDetail...');
    fetchRemboursementDetail();
  }, [payId]);

  const getStatusIcon = (statut: string) => {
    switch (statut) {
      case 'PAYE':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'EN_ATTENTE':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'ANNULEE':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'PAYE':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'EN_ATTENTE':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'ANNULEE':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} GNF`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDownloadReceipt = () => {
    if (!remboursement) return;
    
    const receipt = `
=== RECU DE REMBOURSEMENT ZALAMA ===
Date: ${formatDate(remboursement.date_remboursement_effectue || remboursement.date_creation)}
Statut: ${remboursement.statut}
Transaction ID: ${remboursement.pay_id}
Employé: ${remboursement.employe?.nom} ${remboursement.employe?.prenom}
Téléphone: ${remboursement.employe?.telephone}
Entreprise: ${remboursement.partenaire?.company_name}
Montant: ${formatCurrency(remboursement.montant_total_remboursement)}
Méthode: ${remboursement.methode_remboursement}
${remboursement.demande_avance ? `Montant demandé: ${formatCurrency(remboursement.demande_avance.montant_demande)}` : ''}
${remboursement.demande_avance ? `Date de l'avance: ${formatDate(remboursement.demande_avance.date_validation)}` : ''}
================================
    `;

    const blob = new Blob([receipt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recu-remboursement-${remboursement.pay_id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  console.log('=== RENDU ===');
  console.log('isLoading:', isLoading);
  console.log('error:', error);
  console.log('remboursement:', remboursement);
  console.log('payId:', payId);

  if (isLoading) {
    console.log('Affichage du loader...');
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Chargement du remboursement...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !remboursement) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-600 mb-2">Erreur</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {error || 'Remboursement non trouvé'}
            </p>
            <Button onClick={() => router.push('/dashboard/remboursements')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux remboursements
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => router.push('/dashboard/remboursements')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Détail du Remboursement</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Transaction ID: {remboursement.pay_id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(remboursement.statut)}>
            {getStatusIcon(remboursement.statut)}
            <span className="ml-1">{remboursement.statut}</span>
          </Badge>
          {remboursement.statut === 'PAYE' && (
            <Button onClick={handleDownloadReceipt} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Télécharger le reçu
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informations principales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Informations Financières
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Montant du remboursement:</span>
              <span className="font-semibold text-lg">
                {formatCurrency(remboursement.montant_total_remboursement)}
              </span>
            </div>
            {remboursement.demande_avance && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Montant de l'avance:</span>
                <span className="font-semibold">
                  {formatCurrency(remboursement.demande_avance.montant_demande)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Méthode de remboursement:</span>
              <span className="font-semibold">{remboursement.methode_remboursement}</span>
            </div>
            {remboursement.employe?.salaire_net && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Salaire net de l'employé:</span>
                <span className="font-semibold">
                  {formatCurrency(remboursement.employe.salaire_net)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informations temporelles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Dates et Horaires
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Date de création:</span>
              <span className="font-semibold">
                {formatDate(remboursement.date_creation)}
              </span>
            </div>
            {remboursement.date_remboursement_effectue && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Date de remboursement:</span>
                <span className="font-semibold">
                  {formatDate(remboursement.date_remboursement_effectue)}
                </span>
              </div>
            )}
            {remboursement.demande_avance?.date_validation && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Date de l'avance:</span>
                <span className="font-semibold">
                  {formatDate(remboursement.demande_avance.date_validation)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informations employé */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informations Employé
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Nom complet:</span>
              <span className="font-semibold">
                {remboursement.employe?.nom} {remboursement.employe?.prenom}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Téléphone:</span>
              <span className="font-semibold">{remboursement.employe?.telephone}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Salaire net:</span>
              <span className="font-semibold">
                {formatCurrency(remboursement.employe?.salaire_net || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Informations entreprise */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Informations Entreprise
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Nom de l'entreprise:</span>
              <span className="font-semibold">{remboursement.partenaire?.company_name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Email RH:</span>
              <span className="font-semibold">{remboursement.partenaire?.hr_email}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statut Lengo Pay */}
      {remboursement.lengo_status && (
        <Card>
          <CardHeader>
            <CardTitle>Statut Lengo Pay</CardTitle>
            <CardDescription>
              Informations de synchronisation avec le système de paiement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Statut:</span>
                <Badge className={getStatusColor(remboursement.lengo_status.status)}>
                  {remboursement.lengo_status.status}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Montant:</span>
                <span className="font-semibold">
                  {formatCurrency(remboursement.lengo_status.amount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Date:</span>
                <span className="font-semibold">
                  {formatDate(remboursement.lengo_status.date)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 