'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, XCircle, AlertCircle, ArrowLeft, Download, RefreshCw, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

type PaymentStatus = 'success' | 'failed' | 'pending' | 'unknown';

interface PaymentResult {
  status: PaymentStatus;
  transactionId?: string;
  amount?: number;
  currency?: string;
  message?: string;
  timestamp?: string;
  reference?: string;
  employee?: {
    nom: string;
    prenom: string;
    telephone: string;
  };
  partner?: {
    company_name: string;
    hr_email: string;
  };
  synchronisation?: {
    statut_synchronise: boolean;
    ancien_statut: string;
    nouveau_statut: string;
  };
}

interface PaymentResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  payId?: string;
  onRefresh?: () => void;
}

export default function PaymentResultModal({ 
  isOpen, 
  onClose, 
  payId, 
  onRefresh 
}: PaymentResultModalProps) {
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);

  // Fonction pour vérifier le statut via l'API
  const checkPaymentStatus = async (payId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/remboursements/status/${payId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la vérification');
      }
      
      const data = await response.json();
      
      // Mapper les statuts Lengo Pay vers les statuts de l'interface
      const statusMapping: Record<string, PaymentStatus> = {
        'SUCCESS': 'success',
        'FAILED': 'failed',
        'CANCELLED': 'failed',
        'PENDING': 'pending',
        'PAYE': 'success',
        'ANNULEE': 'failed',
        'EN_COURS': 'pending',
        'EN_ATTENTE': 'pending'
      };
      
      // Utiliser le statut Lengo Pay si disponible, sinon le statut de la base de données
      const lengoStatus = data.lengo_status?.status;
      const dbStatus = data.remboursement.statut;
      const statusToMap = lengoStatus || dbStatus;
      
      const mappedStatus = statusMapping[statusToMap] || 'unknown';
      
      // Messages adaptés selon le statut
      const getStatusMessage = (status: PaymentStatus) => {
        switch (status) {
          case 'success':
            return '🎉 Votre remboursement a été traité avec succès ! Le montant a été transféré sur votre compte.';
          case 'failed':
            return '❌ Le remboursement n\'a pas pu être effectué. Veuillez vérifier vos informations et réessayer.';
          case 'pending':
            return '⏳ Votre remboursement est en cours de traitement. Vous recevrez une confirmation sous peu.';
          default:
            return '❓ Impossible de déterminer le statut du remboursement. Veuillez vérifier manuellement.';
        }
      };

      const result: PaymentResult = {
        status: mappedStatus,
        transactionId: data.remboursement.pay_id,
        amount: data.lengo_status?.amount || data.remboursement.montant_total_remboursement,
        currency: 'GNF',
        message: getStatusMessage(mappedStatus),
        timestamp: data.lengo_status?.date || data.remboursement.date_remboursement_effectue || data.remboursement.date_creation,
        reference: data.remboursement.pay_id,
        employee: data.remboursement.employe,
        partner: data.remboursement.partenaire,
        synchronisation: data.synchronisation
      };
      
      setPaymentResult(result);
      
      // Si le statut a été synchronisé, rafraîchir la liste
      if (data.synchronisation?.statut_synchronise && onRefresh) {
        setTimeout(() => {
          onRefresh();
        }, 1000);
      }
      
    } catch (err: any) {
      console.error('Erreur lors de la vérification:', err);
      setError(err.message || 'Erreur lors de la vérification du statut');
      
      // En cas d'erreur, afficher un statut par défaut
      setPaymentResult({
        status: 'unknown',
        message: 'Impossible de vérifier le statut du remboursement.',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour forcer la synchronisation
  const forceSync = async () => {
    if (!payId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/remboursements/status/${payId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_sync: true })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la synchronisation');
      }
      
      // Re-vérifier le statut après synchronisation
      await checkPaymentStatus(payId);
      
    } catch (err: any) {
      console.error('Erreur lors de la synchronisation:', err);
      setError(err.message || 'Erreur lors de la synchronisation');
    } finally {
      setIsLoading(false);
    }
  };

  // Vérifier le statut quand la modal s'ouvre
  useEffect(() => {
    if (isOpen && payId) {
      checkPaymentStatus(payId);
    }
  }, [isOpen, payId]);

  // Vérification périodique pour les statuts en attente
  useEffect(() => {
    if (!isOpen || !payId || !paymentResult || paymentResult.status !== 'pending') {
      return;
    }

    const interval = setInterval(() => {
      checkPaymentStatus(payId);
    }, 10000); // Vérifier toutes les 10 secondes

    return () => clearInterval(interval);
  }, [isOpen, payId, paymentResult?.status]);

  // Redirection automatique avec compteur pour les succès
  useEffect(() => {
    if (!isOpen || !payId || !paymentResult || paymentResult.status !== 'success') {
      setCountdown(5);
      return;
    }

    console.log('Paiement réussi, redirection dans 5 secondes...');
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          console.log('Redirection automatique vers la page de détail...');
          window.location.href = `/dashboard/remboursements/detail/${payId}`;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, payId, paymentResult?.status]);

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-16 w-16 text-green-500" />;
      case 'failed':
        return <XCircle className="h-16 w-16 text-red-500" />;
      case 'pending':
        return <Clock className="h-16 w-16 text-yellow-500 animate-pulse" />;
      default:
        return <AlertCircle className="h-16 w-16 text-gray-500" />;
    }
  };

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      case 'pending':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusBgColor = (status: PaymentStatus) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'failed':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'pending':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
    }
  };

  const handleDownloadReceipt = () => {
    if (!paymentResult) return;
    
    const receipt = `
=== RECU DE REMBOURSEMENT ZALAMA ===
Date: ${new Date(paymentResult.timestamp || '').toLocaleString('fr-FR')}
Statut: ${paymentResult.status === 'success' ? 'SUCCES' : paymentResult.status === 'failed' ? 'ECHEC' : 'EN ATTENTE'}
${paymentResult.transactionId ? `Transaction ID: ${paymentResult.transactionId}` : ''}
${paymentResult.employee ? `Employé: ${paymentResult.employee.nom} ${paymentResult.employee.prenom}` : ''}
${paymentResult.employee ? `Téléphone: ${paymentResult.employee.telephone}` : ''}
${paymentResult.partner ? `Entreprise: ${paymentResult.partner.company_name}` : ''}
${paymentResult.amount ? `Montant: ${paymentResult.amount.toLocaleString()} ${paymentResult.currency}` : ''}
Message: ${paymentResult.message}
${paymentResult.synchronisation?.statut_synchronise ? `Synchronisation: ${paymentResult.synchronisation.ancien_statut} → ${paymentResult.synchronisation.nouveau_statut}` : ''}
================================
    `;

    const blob = new Blob([receipt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recu-remboursement-${paymentResult.transactionId || Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-lg ${paymentResult ? getStatusBgColor(paymentResult.status) : ''}`}>
        <DialogHeader className="text-center">
          {isLoading && !paymentResult ? (
            <div className="flex flex-col items-center space-y-4">
              <RefreshCw className="h-16 w-16 text-blue-500 animate-spin" />
              <DialogTitle className="text-xl">Vérification du remboursement...</DialogTitle>
              <DialogDescription>
                Vérification du statut en cours...
              </DialogDescription>
            </div>
          ) : paymentResult ? (
            <>
              <div className="flex justify-center mb-4">
                {getStatusIcon(paymentResult.status)}
              </div>
              <DialogTitle className={`text-2xl font-bold ${getStatusColor(paymentResult.status)}`}>
                {paymentResult.status === 'success' && 'Remboursement Réussi !'}
                {paymentResult.status === 'failed' && 'Remboursement Échoué'}
                {paymentResult.status === 'pending' && 'Remboursement en Cours'}
                {paymentResult.status === 'unknown' && 'Statut Inconnu'}
              </DialogTitle>
              <DialogDescription className="text-lg mt-2">
                {paymentResult.message}
                {paymentResult.status === 'success' && (
                  <div className="mt-2 text-sm text-green-600 dark:text-green-400">
                    Redirection automatique vers la page de détail dans {countdown} seconde{countdown > 1 ? 's' : ''}...
                  </div>
                )}
              </DialogDescription>
            </>
          ) : (
            <DialogTitle className="text-xl text-red-600">Erreur</DialogTitle>
          )}
        </DialogHeader>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {paymentResult && (
          <div className="space-y-6">
            {/* Détails de la transaction */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Détails du remboursement</h3>
              {paymentResult.transactionId && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Transaction ID:</span>
                  <span className="font-mono text-sm">{paymentResult.transactionId}</span>
                </div>
              )}
              {paymentResult.employee && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Employé:</span>
                  <span className="font-semibold">{paymentResult.employee.nom} {paymentResult.employee.prenom}</span>
                </div>
              )}
              {paymentResult.employee?.telephone && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Téléphone:</span>
                  <span className="font-semibold">{paymentResult.employee.telephone}</span>
                </div>
              )}
              {paymentResult.partner && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Entreprise:</span>
                  <span className="font-semibold">{paymentResult.partner.company_name}</span>
                </div>
              )}
              {paymentResult.amount && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Montant:</span>
                  <span className="font-semibold">
                    {paymentResult.amount.toLocaleString()} {paymentResult.currency}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Date:</span>
                <span className="text-sm">
                  {new Date(paymentResult.timestamp || '').toLocaleString('fr-FR')}
                </span>
              </div>
              {paymentResult.synchronisation?.statut_synchronise && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Synchronisation:</span>
                  <span className="text-sm text-green-600 dark:text-green-400">
                    {paymentResult.synchronisation.ancien_statut} → {paymentResult.synchronisation.nouveau_statut}
                  </span>
                </div>
              )}
            </div>

            {/* Informations supplémentaires */}
            <div className={`rounded-lg p-4 ${
              paymentResult.status === 'success' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' :
              paymentResult.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
              paymentResult.status === 'pending' ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' :
              'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
            }`}>
              <h4 className={`font-semibold mb-3 ${
                paymentResult.status === 'success' ? 'text-green-900 dark:text-green-100' :
                paymentResult.status === 'failed' ? 'text-red-900 dark:text-red-100' :
                paymentResult.status === 'pending' ? 'text-yellow-900 dark:text-yellow-100' :
                'text-blue-900 dark:text-blue-100'
              }`}>
                {paymentResult.status === 'success' && '✅ Paiement Réussi'}
                {paymentResult.status === 'failed' && '❌ Paiement Échoué'}
                {paymentResult.status === 'pending' && '⏳ Paiement en Cours'}
                {paymentResult.status === 'unknown' && '❓ Statut Inconnu'}
              </h4>
              <ul className={`text-sm space-y-2 ${
                paymentResult.status === 'success' ? 'text-green-800 dark:text-green-200' :
                paymentResult.status === 'failed' ? 'text-red-800 dark:text-red-200' :
                paymentResult.status === 'pending' ? 'text-yellow-800 dark:text-yellow-200' :
                'text-blue-800 dark:text-blue-200'
              }`}>
                {paymentResult.status === 'success' && (
                  <>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Votre remboursement a été traité avec succès</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Le montant a été transféré sur votre compte</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Un reçu électronique a été généré</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Le statut est mis à jour dans votre tableau de bord</span>
                    </li>
                  </>
                )}
                {paymentResult.status === 'failed' && (
                  <>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600">✗</span>
                      <span>Le remboursement n'a pas pu être traité</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600">✗</span>
                      <span>Vérifiez vos informations de paiement</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600">✗</span>
                      <span>Assurez-vous d'avoir suffisamment de fonds</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600">✗</span>
                      <span>Contactez le support si le problème persiste</span>
                    </li>
                  </>
                )}
                {paymentResult.status === 'pending' && (
                  <>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-600">⏳</span>
                      <span>Votre remboursement est en cours de traitement</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-600">⏳</span>
                      <span>Le traitement peut prendre quelques minutes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-600">⏳</span>
                      <span>Vous recevrez une confirmation par email</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-600">⏳</span>
                      <span>Cette page se met à jour automatiquement</span>
                    </li>
                  </>
                )}
                {paymentResult.status === 'unknown' && (
                  <>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-600">❓</span>
                      <span>Impossible de déterminer le statut</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-600">❓</span>
                      <span>Vérifiez manuellement le statut</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-600">❓</span>
                      <span>Contactez le support si nécessaire</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {paymentResult?.status === 'success' && (
            <>
              <Button onClick={handleDownloadReceipt} className="bg-green-600 hover:bg-green-700">
                <Download className="h-4 w-4 mr-2" />
                Télécharger le reçu
              </Button>
              <Button 
                onClick={() => window.location.href = `/dashboard/remboursements/detail/${payId}`}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Voir les détails
              </Button>
            </>
          )}
          
          {paymentResult?.status === 'failed' && (
            <Button onClick={onClose} className="bg-red-600 hover:bg-red-700">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à la liste
            </Button>
          )}
          
          {paymentResult?.status === 'pending' && (
            <>
              <Button onClick={forceSync} disabled={isLoading} variant="outline">
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Synchronisation...' : 'Forcer la synchronisation'}
              </Button>
              <Button onClick={onClose} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Fermer
              </Button>
            </>
          )}
          
          {paymentResult?.status === 'unknown' && (
            <Button onClick={onClose} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Fermer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 