# 🔧 Correction des URLs de Retour de Paiement - Lengo Pay

## 🚨 Problème Identifié

**Symptôme :** Peu importe le statut du paiement sur l'interface de Lengo Pay (succès, échec, annulation), l'utilisateur est toujours redirigé vers la page `/dashboard/remboursements/success`.

**Cause :** Configuration incorrecte des URLs de retour dans l'API backend. Une seule URL de retour est configurée au lieu d'URLs spécifiques selon le statut.

## 📋 Configuration Actuelle (Problématique)

```javascript
// ❌ Configuration actuelle - TOUJOURS redirige vers success
const paymentData = {
  remboursement_id: remboursementId,
  amount: montant,
  currency: 'GNF',
  return_url: 'https://votre-domaine.com/dashboard/remboursements/success', // ❌ Problème ici
  // Pas de configuration pour les autres statuts
};
```

## ✅ Configuration Correcte (Solution)

### 1. URLs de Retour Spécifiques par Statut

```javascript
// ✅ Configuration correcte
const paymentData = {
  remboursement_id: remboursementId,
  amount: montant,
  currency: 'GNF',
  
  // URLs de retour selon le statut
  success_url: `${process.env.APP_URL}/dashboard/remboursements/success`,
  failed_url: `${process.env.APP_URL}/dashboard/remboursements/failed`,
  pending_url: `${process.env.APP_URL}/dashboard/remboursements/pending`,
  cancel_url: `${process.env.APP_URL}/dashboard/remboursements/failed`,
  
  // URL de retour générique (fallback)
  return_url: `${process.env.APP_URL}/payment-result`,
  
  // Webhook pour notifications en temps réel
  webhook_url: `${process.env.APP_URL}/api/payment-webhook`
};
```

### 2. Variables d'Environnement Requises

```env
# Dans le fichier .env du backend
APP_URL=https://votre-domaine.com
# ou pour le développement
APP_URL=http://localhost:3000
```

## 🔄 Workflow de Paiement Correct

### 1. Initiation du Paiement
```javascript
// POST /api/remboursements/simple-paiement
const response = await fetch('https://admin.zalamasas.com/api/remboursements/simple-paiement', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ remboursement_id: id })
});
```

### 2. Redirection vers Lengo Pay
```javascript
// L'utilisateur est redirigé vers l'interface de paiement
if (data.payment_url) {
  window.open(data.payment_url, '_blank');
}
```

### 3. Retour selon le Statut
- **Paiement réussi** → `/dashboard/remboursements/success?pay_id=...`
- **Paiement échoué** → `/dashboard/remboursements/failed?pay_id=...`
- **Paiement en attente** → `/dashboard/remboursements/pending?pay_id=...`
- **Paiement annulé** → `/dashboard/remboursements/failed?pay_id=...`

## 📡 Paramètres de Retour Attendus

### Paramètres Obligatoires
- `pay_id` : Identifiant unique de la transaction Lengo Pay
- `transaction_id` : ID de la transaction (optionnel)
- `amount` : Montant du paiement
- `status` : Statut du paiement (success, failed, pending, cancelled)

### Paramètres Optionnels
- `message` : Message de statut ou d'erreur
- `error` : Message d'erreur détaillé (en cas d'échec)
- `currency` : Devise (GNF)

## 🛠️ Implémentation Technique

### 1. API de Paiement Individuel

```javascript
// Dans votre API de paiement individuel
app.post('/api/remboursements/simple-paiement', async (req, res) => {
  try {
    const { remboursement_id } = req.body;
    
    // Récupérer les informations du remboursement
    const remboursement = await getRemboursement(remboursement_id);
    
    // Configuration Lengo Pay avec URLs spécifiques
    const paymentData = {
      site_id: process.env.LENGO_SITE_ID,
      amount: remboursement.montant_total_remboursement,
      currency: 'GNF',
      reference: remboursement.id,
      
      // URLs de retour selon le statut
      success_url: `${process.env.APP_URL}/dashboard/remboursements/success`,
      failed_url: `${process.env.APP_URL}/dashboard/remboursements/failed`,
      pending_url: `${process.env.APP_URL}/dashboard/remboursements/pending`,
      cancel_url: `${process.env.APP_URL}/dashboard/remboursements/failed`,
      
      // URL de retour générique (fallback)
      return_url: `${process.env.APP_URL}/payment-result`,
      
      // Webhook
      webhook_url: `${process.env.APP_URL}/api/payment-webhook`,
      
      // Métadonnées
      metadata: {
        remboursement_id: remboursement.id,
        partenaire_id: remboursement.partenaire_id,
        employe_id: remboursement.employe_id
      }
    };
    
    // Appel à l'API Lengo Pay
    const lengoResponse = await fetch('https://portal.lengopay.com/api/v1/payment/create', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${process.env.LENGO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });
    
    const lengoData = await lengoResponse.json();
    
    if (lengoData.success) {
      // Mettre à jour le remboursement avec le pay_id
      await updateRemboursement(remboursement_id, {
        pay_id: lengoData.pay_id,
        statut: 'EN_ATTENTE'
      });
      
      res.json({
        success: true,
        pay_id: lengoData.pay_id,
        payment_url: lengoData.payment_url,
        montant: remboursement.montant_total_remboursement
      });
    } else {
      res.status(400).json({
        success: false,
        error: lengoData.message || 'Erreur lors de la création du paiement'
      });
    }
  } catch (error) {
    console.error('Erreur paiement:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});
```

### 2. API de Paiement en Lot

```javascript
// Dans votre API de paiement en lot
app.post('/api/remboursements/simple-paiement-lot', async (req, res) => {
  try {
    const { partenaire_id } = req.body;
    
    // Récupérer tous les remboursements en attente du partenaire
    const remboursements = await getRemboursementsEnAttente(partenaire_id);
    const montantTotal = remboursements.reduce((sum, r) => sum + r.montant_total_remboursement, 0);
    
    // Configuration Lengo Pay pour paiement en lot
    const paymentData = {
      site_id: process.env.LENGO_SITE_ID,
      amount: montantTotal,
      currency: 'GNF',
      reference: `LOT_${partenaire_id}_${Date.now()}`,
      
      // URLs de retour selon le statut
      success_url: `${process.env.APP_URL}/dashboard/remboursements/success`,
      failed_url: `${process.env.APP_URL}/dashboard/remboursements/failed`,
      pending_url: `${process.env.APP_URL}/dashboard/remboursements/pending`,
      cancel_url: `${process.env.APP_URL}/dashboard/remboursements/failed`,
      
      // URL de retour générique (fallback)
      return_url: `${process.env.APP_URL}/payment-result`,
      
      // Webhook
      webhook_url: `${process.env.APP_URL}/api/payment-webhook`,
      
      // Métadonnées pour paiement en lot
      metadata: {
        partenaire_id: partenaire_id,
        nombre_remboursements: remboursements.length,
        type: 'paiement_lot'
      }
    };
    
    // Appel à l'API Lengo Pay
    const lengoResponse = await fetch('https://portal.lengopay.com/api/v1/payment/create', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${process.env.LENGO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });
    
    const lengoData = await lengoResponse.json();
    
    if (lengoData.success) {
      // Mettre à jour tous les remboursements avec le pay_id
      await updateRemboursementsLot(partenaire_id, {
        pay_id: lengoData.pay_id,
        statut: 'EN_ATTENTE'
      });
      
      res.json({
        success: true,
        pay_id: lengoData.pay_id,
        payment_url: lengoData.payment_url,
        nombre_remboursements: remboursements.length,
        montant_total: montantTotal
      });
    } else {
      res.status(400).json({
        success: false,
        error: lengoData.message || 'Erreur lors de la création du paiement en lot'
      });
    }
  } catch (error) {
    console.error('Erreur paiement en lot:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});
```

## 🧪 Tests et Validation

### 1. Test de Configuration

```javascript
// Script de test pour vérifier la configuration
const testPaymentConfig = {
  site_id: process.env.LENGO_SITE_ID,
  amount: 1000, // Montant de test
  currency: 'GNF',
  reference: 'TEST_' + Date.now(),
  
  // URLs de test
  success_url: `${process.env.APP_URL}/dashboard/remboursements/success`,
  failed_url: `${process.env.APP_URL}/dashboard/remboursements/failed`,
  pending_url: `${process.env.APP_URL}/dashboard/remboursements/pending`,
  cancel_url: `${process.env.APP_URL}/dashboard/remboursements/failed`,
  return_url: `${process.env.APP_URL}/payment-result`,
  
  // Métadonnées de test
  metadata: {
    test: true,
    timestamp: new Date().toISOString()
  }
};

console.log('Configuration de test:', JSON.stringify(testPaymentConfig, null, 2));
```

### 2. Validation des URLs

Vérifiez que toutes les URLs sont accessibles :
- ✅ `https://votre-domaine.com/dashboard/remboursements/success`
- ✅ `https://votre-domaine.com/dashboard/remboursements/failed`
- ✅ `https://votre-domaine.com/dashboard/remboursements/pending`
- ✅ `https://votre-domaine.com/payment-result`

## 🔍 Debugging

### 1. Logs de Debug

```javascript
// Ajouter ces logs dans votre API
console.log('Configuration Lengo Pay:', {
  success_url: paymentData.success_url,
  failed_url: paymentData.failed_url,
  pending_url: paymentData.pending_url,
  cancel_url: paymentData.cancel_url,
  return_url: paymentData.return_url
});

console.log('Réponse Lengo Pay:', lengoData);
```

### 2. Vérification des Paramètres

```javascript
// Dans les pages de retour, vérifier les paramètres reçus
console.log('Paramètres de retour reçus:', {
  pay_id: searchParams.get('pay_id'),
  status: searchParams.get('status'),
  transaction_id: searchParams.get('transaction_id'),
  amount: searchParams.get('amount'),
  message: searchParams.get('message'),
  error: searchParams.get('error')
});
```

## 📞 Support

Si vous avez des questions ou besoin d'aide pour l'implémentation :

1. **Documentation Lengo Pay** : Consultez la documentation officielle pour les paramètres exacts
2. **Logs de debug** : Vérifiez les logs pour identifier les problèmes
3. **Tests en environnement de développement** : Testez d'abord en local

## ✅ Checklist de Validation

- [ ] URLs de retour configurées selon le statut
- [ ] Variable d'environnement `APP_URL` définie
- [ ] Webhook configuré pour les notifications
- [ ] Tests effectués avec différents statuts
- [ ] Logs de debug ajoutés
- [ ] Documentation mise à jour

---

**Date de création :** $(date)  
**Version :** 1.0  
**Auteur :** Équipe Frontend ZaLaMa Partner Dashboard 