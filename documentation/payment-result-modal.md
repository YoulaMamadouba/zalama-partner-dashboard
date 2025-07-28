# Modal de Résultat de Paiement - Documentation

## 📋 Vue d'ensemble

La modal de résultat de paiement remplace l'ancienne page de résultat et offre une expérience utilisateur améliorée avec vérification en temps réel du statut des remboursements via l'API Lengo Pay.

## 🎯 Fonctionnalités

### ✅ Vérification en temps réel
- **Vérification automatique** : Le statut est vérifié automatiquement lors de l'ouverture de la modal
- **Synchronisation avec Lengo Pay** : Utilise l'API `/api/remboursements/status/{pay_id}` pour vérifier le statut réel
- **Mise à jour automatique** : Pour les statuts "en cours", vérification toutes les 10 secondes

### 🔄 Synchronisation forcée
- **Bouton de synchronisation** : Permet de forcer la vérification du statut
- **Mise à jour de la base de données** : Synchronise automatiquement les changements de statut
- **Feedback visuel** : Indique si une synchronisation a eu lieu

### 📊 Informations détaillées
- **Détails de l'employé** : Nom, prénom, téléphone
- **Informations de l'entreprise** : Nom de l'entreprise, email RH
- **Détails de la transaction** : Montant, date, statut
- **Historique de synchronisation** : Ancien statut → Nouveau statut

## 🚀 Utilisation

### 1. Workflow de paiement complet
```typescript
// 1. L'utilisateur clique sur "Payer"
const handlePayer = async (id: string) => {
  const response = await fetch('/api/remboursements/simple-paiement', {
    method: 'POST',
    body: JSON.stringify({ remboursement_id: id })
  });
  
  const data = await response.json();
  
  if (data.success && data.payment_url) {
    // 2. Redirection vers l'interface de paiement de Lengo Pay
    window.open(data.payment_url, '_blank');
  }
};

// 3. Après paiement, l'utilisateur revient via /dashboard/remboursements/success
// 4. La modal s'ouvre automatiquement pour vérifier le statut
```

### 2. Retour de paiement automatique
- **URL de retour** : `/dashboard/remboursements/success?pay_id=...` (succès)
- **URL de retour** : `/dashboard/remboursements/failed?pay_id=...` (échec)
- **URL de retour** : `/dashboard/remboursements/pending?pay_id=...` (en attente)
- **Redirection automatique** : Vers `/dashboard/remboursements?check_payment=true`
- **Ouverture de la modal** : Automatique avec vérification du statut

### 3. Vérification manuelle d'un remboursement
```typescript
// Bouton "Vérifier" dans la liste des remboursements
<Button
  onClick={() => {
    setCurrentPayId(remboursement.pay_id);
    setShowPaymentResultModal(true);
  }}
>
  🔍 Vérifier
</Button>
```

### 4. Intégration du composant
```typescript
import PaymentResultModal from '@/components/dashboard/PaymentResultModal';

// Dans votre composant
<PaymentResultModal
  isOpen={showPaymentResultModal}
  onClose={() => {
    setShowPaymentResultModal(false);
    setCurrentPayId(undefined);
  }}
  payId={currentPayId}
  onRefresh={fetchRemboursements}
/>
```

## 🎨 Interface utilisateur

### États visuels
- **🟢 Succès** : Icône verte, message de confirmation, bouton de téléchargement du reçu
- **🔴 Échec** : Icône rouge, message d'erreur, informations de support
- **🟡 En cours** : Icône jaune animée, message d'attente, bouton de synchronisation
- **⚪ Inconnu** : Icône grise, message d'erreur, possibilité de réessayer

### Actions disponibles
- **Télécharger le reçu** : Pour les paiements réussis
- **Forcer la synchronisation** : Pour les paiements en cours
- **Fermer** : Retour à la liste des remboursements

## 🔧 Configuration

### Variables d'environnement
```env
# Configuration Lengo Pay
LENGO_API_KEY=your-lengo-api-key-here
```

### API Endpoints
- **GET** `/api/remboursements/status/{pay_id}` : Vérification du statut
- **POST** `/api/remboursements/status/{pay_id}` : Synchronisation forcée

## 📱 Responsive Design

La modal s'adapte automatiquement aux différentes tailles d'écran :
- **Desktop** : Largeur maximale de 512px (max-w-lg)
- **Tablet** : Adaptation automatique
- **Mobile** : Pleine largeur avec marges

## 🔄 Workflow complet

1. **Initiation du paiement** → L'utilisateur clique sur "Payer"
2. **Redirection vers Lengo Pay** → Ouverture de l'interface de paiement
3. **Paiement effectué** → L'utilisateur paie sur l'interface de Lengo Pay
4. **Retour automatique** → Redirection vers `/dashboard/remboursements/success` (ou failed/pending)
5. **Ouverture de la modal** → Vérification automatique du statut
6. **Affichage du résultat** → Interface adaptée selon le statut
7. **Synchronisation** → Mise à jour de la base de données si nécessaire
8. **Rafraîchissement** → Mise à jour de la liste des remboursements

## 🛡️ Gestion d'erreurs

### Erreurs courantes
- **404** : Remboursement non trouvé
- **401** : Clé API Lengo Pay invalide
- **500** : Erreur interne du serveur

### Stratégie de fallback
- En cas d'erreur, affichage d'un statut "inconnu"
- Possibilité de réessayer via le bouton de synchronisation
- Messages d'erreur clairs pour l'utilisateur

## 📈 Avantages

### Pour l'utilisateur
- **Feedback immédiat** : Pas besoin de recharger la page
- **Informations complètes** : Tous les détails en un coup d'œil
- **Actions contextuelles** : Boutons adaptés selon le statut

### Pour le développeur
- **Code modulaire** : Composant réutilisable
- **Gestion d'état robuste** : États de chargement et d'erreur
- **API intégrée** : Vérification automatique avec Lengo Pay

## 🔮 Évolutions futures

- **Notifications push** : Alertes en temps réel
- **Historique des vérifications** : Log des synchronisations
- **Export des données** : Génération de rapports
- **Intégration webhook** : Mise à jour automatique via webhooks 