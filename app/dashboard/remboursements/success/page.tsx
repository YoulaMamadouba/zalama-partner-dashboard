'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Download, Receipt, Clock } from 'lucide-react';

export default function RemboursementSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(10);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // Récupérer les paramètres de retour de Lengo Pay
    const payId = searchParams.get('pay_id');
    const transactionId = searchParams.get('transaction_id');
    const amount = searchParams.get('amount');
    const message = searchParams.get('message');

    console.log('Remboursement réussi:', { payId, transactionId, amount, message });

    // Compteur de 10 secondes avant redirection
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRedirecting(true);
          // Rediriger vers la liste des remboursements avec paramètre pour ouvrir la modal
          if (payId) {
            sessionStorage.setItem('pendingPaymentCheck', payId);
            router.push(`/dashboard/remboursements?check_payment=true&pay_id=${payId}`);
          } else {
            router.push('/dashboard/remboursements');
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [searchParams, router]);

  const formatAmount = (amount: string | null) => {
    if (!amount) return 'N/A';
    return `${parseInt(amount).toLocaleString()} GNF`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="text-center max-w-lg">
        {/* Animation de succès */}
        <div className="mb-8">
          <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-4 animate-bounce" />
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mx-auto flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        {/* Titre principal */}
        <h1 className="text-3xl font-bold text-green-700 dark:text-green-400 mb-4">
          🎉 Paiement Réussi !
        </h1>

        {/* Message de félicitations */}
        <p className="text-lg text-green-600 dark:text-green-300 mb-6">
          Félicitations ! Votre remboursement a été traité avec succès.
        </p>

        {/* Informations du remboursement */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            📋 Détails du Remboursement
          </h3>
          
          <div className="space-y-3 text-left">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Montant :</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {formatAmount(searchParams.get('amount'))}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Transaction ID :</span>
              <span className="font-mono text-sm text-gray-500 dark:text-gray-500">
                {searchParams.get('transaction_id') || 'N/A'}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Pay ID :</span>
              <span className="font-mono text-sm text-gray-500 dark:text-gray-500">
                {searchParams.get('pay_id') || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Informations importantes */}
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3">
            ✅ Informations Importantes
          </h4>
          <ul className="text-sm text-green-800 dark:text-green-200 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Le montant a été transféré sur votre compte</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Vous recevrez une confirmation par SMS</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Le reçu est disponible dans votre espace</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Vous pouvez télécharger le reçu de paiement</span>
            </li>
          </ul>
        </div>

        {/* Compteur de redirection */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <span className="text-blue-700 dark:text-blue-300 font-medium">
              Redirection automatique
            </span>
          </div>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            Vous allez être redirigé vers la page de détail dans {countdown} seconde{countdown > 1 ? 's' : ''}...
          </p>
        </div>

        {/* Boutons d'action */}
        <div className="flex gap-3 mt-6 justify-center">
          <button
            onClick={() => {
              // Télécharger le reçu (à implémenter)
              console.log('Télécharger le reçu');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            Télécharger le reçu
          </button>
          
          <button
            onClick={() => {
              setIsRedirecting(true);
              const payId = searchParams.get('pay_id');
              if (payId) {
                sessionStorage.setItem('pendingPaymentCheck', payId);
                router.push(`/dashboard/remboursements?check_payment=true&pay_id=${payId}`);
              } else {
                router.push('/dashboard/remboursements');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Receipt className="h-4 w-4" />
            Voir les détails
          </button>
        </div>

        {/* Indicateur de redirection */}
        {isRedirecting && (
          <div className="mt-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Redirection en cours...</p>
          </div>
        )}
      </div>
    </div>
  );
} 