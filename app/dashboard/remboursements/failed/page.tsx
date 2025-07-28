'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { XCircle, AlertTriangle } from 'lucide-react';

export default function RemboursementFailedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Récupérer les paramètres de retour de Lengo Pay
    const payId = searchParams.get('pay_id');
    const transactionId = searchParams.get('transaction_id');
    const amount = searchParams.get('amount');
    const message = searchParams.get('message');
    const error = searchParams.get('error');

    console.log('Remboursement échoué:', { payId, transactionId, amount, message, error });

    // Compteur de 5 secondes
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Rediriger vers la liste des remboursements
          router.push('/dashboard/remboursements');
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <XCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-4">
          Remboursement Échoué
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Le remboursement n'a pas pu être traité. Vous allez être redirigé vers la liste des remboursements dans {countdown} seconde{countdown > 1 ? 's' : ''}.
        </p>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-sm text-red-700 dark:text-red-300">
              {searchParams.get('error') || searchParams.get('message') || 'Une erreur est survenue lors du traitement'}
            </span>
          </div>
        </div>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
          Redirection automatique...
        </p>
      </div>
    </div>
  );
} 