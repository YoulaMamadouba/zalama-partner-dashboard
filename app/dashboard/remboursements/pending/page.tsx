'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock, AlertCircle } from 'lucide-react';

export default function RemboursementPendingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Récupérer les paramètres de retour de Lengo Pay
    const payId = searchParams.get('pay_id');
    const transactionId = searchParams.get('transaction_id');
    const amount = searchParams.get('amount');
    const message = searchParams.get('message');

    console.log('Remboursement en attente:', { payId, transactionId, amount, message });

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
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <Clock className="h-16 w-16 text-yellow-500 mx-auto mb-6 animate-pulse" />
        <h1 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">
          Remboursement en Cours
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Votre remboursement est en cours de traitement. Vous allez être redirigé vers la liste des remboursements dans {countdown} seconde{countdown > 1 ? 's' : ''}.
        </p>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <span className="text-sm text-yellow-700 dark:text-yellow-300">
              Le traitement peut prendre quelques minutes
            </span>
          </div>
        </div>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto"></div>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
          Redirection automatique...
        </p>
      </div>
    </div>
  );
} 