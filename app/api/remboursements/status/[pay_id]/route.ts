import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Configuration Lengo Pay
const LENGO_API_URL = 'https://portal.lengopay.com/api/v1/transaction/status';
const LENGO_SITE_ID = 'ozazlahgzpntmYAG';
const LENGO_API_KEY = process.env.LENGO_API_KEY || 'default-key';

// Mapping des statuts Lengo Pay vers statuts internes
const STATUS_MAPPING = {
  'SUCCESS': 'PAYE',
  'FAILED': 'ANNULEE',
  'CANCELLED': 'ANNULEE',
  'PENDING': 'EN_COURS'
};

// Fonction pour vérifier le statut avec Lengo Pay
async function checkLengoStatus(payId: string) {
  try {
    console.log('🔍 Vérification du statut Lengo Pay pour:', payId);
    
    const response = await fetch(LENGO_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${LENGO_API_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        site_id: LENGO_SITE_ID,
        pay_id: payId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur API Lengo Pay:', response.status, errorText);
      throw new Error(`Erreur API Lengo Pay: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Réponse API Lengo Pay:', data);
    
    return {
      status: data.status,
      pay_id: data.pay_id,
      date: data.date,
      amount: data.amount
    };
  } catch (error) {
    console.error('❌ Erreur lors de la vérification Lengo Pay:', error);
    throw error;
  }
}

// Fonction pour récupérer un remboursement avec ses relations
async function getRemboursement(payId: string) {
  const { data, error } = await supabase
    .from('remboursements')
    .select(`
      *,
      employe:employees!remboursements_employe_id_fkey(
        id, nom, prenom, telephone
      ),
      partenaire:partners!remboursements_partenaire_id_fkey(
        id, company_name, hr_email
      ),
      transaction:transactions!remboursements_transaction_id_fkey(*),
      demande_avance:salary_advance_requests!remboursements_demande_avance_id_fkey(*)
    `)
    .eq('pay_id', payId)
    .single();

  if (error) {
    console.error('❌ Erreur lors de la récupération du remboursement:', error);
    throw error;
  }

  return data;
}

// Fonction pour mettre à jour le statut du remboursement
async function updateRemboursementStatus(payId: string, newStatus: string, lengoData: any) {
  const updateData: any = {
    statut: newStatus,
    updated_at: new Date().toISOString()
  };

  // Ajouter des champs spécifiques selon le statut
  if (newStatus === 'PAYE') {
    updateData.date_remboursement_effectue = lengoData.date || new Date().toISOString();
    updateData.numero_reception = lengoData.phone || null;
  } else if (newStatus === 'ANNULEE') {
    updateData.date_annulation = new Date().toISOString();
  }

  const { error } = await supabase
    .from('remboursements')
    .update(updateData)
    .eq('pay_id', payId);

  if (error) {
    console.error('❌ Erreur lors de la mise à jour du statut:', error);
    throw error;
  }

  console.log('✅ Statut mis à jour dans la base de données:', { pay_id: payId, ancien_statut: 'EN_ATTENTE', nouveau_statut: newStatus });
}

// GET - Vérification du statut
export async function GET(
  request: NextRequest,
  { params }: { params: { pay_id: string } }
) {
  try {
    const { pay_id } = params;

    if (!pay_id) {
      return NextResponse.json({ error: 'Pay ID requis' }, { status: 400 });
    }

    console.log('🔍 Vérification du statut pour pay_id:', pay_id);

    // Récupérer le remboursement
    const remboursement = await getRemboursement(pay_id);

    // Vérifier le statut avec Lengo Pay
    const lengoStatus = await checkLengoStatus(pay_id);

    // Mapper le statut Lengo Pay vers le statut interne
    const nouveauStatut = STATUS_MAPPING[lengoStatus.status as keyof typeof STATUS_MAPPING] || 'EN_ATTENTE';
    const ancienStatut = remboursement.statut;
    const statutSynchronise = ancienStatut !== nouveauStatut;

    // Synchroniser si le statut a changé
    if (statutSynchronise) {
      try {
        await updateRemboursementStatus(pay_id, nouveauStatut, lengoStatus);
      } catch (updateError) {
        console.error('⚠️ Erreur lors de la synchronisation (non bloquante):', updateError);
        // Ne pas faire échouer la requête si la mise à jour échoue
      }
    }

    // Préparer la réponse
    const response = {
      remboursement: {
        id: remboursement.id,
        pay_id: remboursement.pay_id,
        montant: remboursement.montant_total_remboursement,
        statut: statutSynchronise ? nouveauStatut : remboursement.statut,
        methode_remboursement: 'MOBILE_MONEY',
        date_creation: remboursement.date_creation,
        date_remboursement: remboursement.date_remboursement_effectue,
        employe: {
          id: remboursement.employe?.id,
          nom: remboursement.employe?.nom,
          prenom: remboursement.employe?.prenom,
          telephone: remboursement.employe?.telephone
        },
        partenaire: {
          id: remboursement.partenaire?.id,
          company_name: remboursement.partenaire?.company_name,
          hr_email: remboursement.partenaire?.hr_email
        }
      },
      lengo_status: {
        status: lengoStatus.status,
        pay_id: lengoStatus.pay_id,
        date: lengoStatus.date,
        amount: lengoStatus.amount
      },
      synchronisation: {
        statut_synchronise: statutSynchronise,
        ancien_statut: ancienStatut,
        nouveau_statut: nouveauStatut
      }
    };

    console.log('✅ Statut du remboursement récupéré avec succès:', {
      pay_id,
      statut_db: response.remboursement.statut,
      statut_lengo: lengoStatus.status,
      synchronise: statutSynchronise
    });

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification du statut:', error);

    if (error.message?.includes('No rows found')) {
      return NextResponse.json({ error: 'Remboursement non trouvé' }, { status: 404 });
    }

    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({
        error: 'Erreur lors de la vérification du statut',
        details: JSON.stringify({ error: 'Unauthorized !' }),
        status: 401
      }, { status: 500 });
    }

    return NextResponse.json({
      error: 'Erreur lors de la vérification du statut',
      details: error.message
    }, { status: 500 });
  }
}

// POST - Synchronisation forcée
export async function POST(
  request: NextRequest,
  { params }: { params: { pay_id: string } }
) {
  try {
    const { pay_id } = params;
    const body = await request.json();
    const { force_sync } = body;

    if (!pay_id) {
      return NextResponse.json({ error: 'Pay ID requis' }, { status: 400 });
    }

    console.log('🔄 Synchronisation forcée pour pay_id:', pay_id);

    // Récupérer le remboursement
    const remboursement = await getRemboursement(pay_id);

    // Vérifier le statut avec Lengo Pay
    const lengoStatus = await checkLengoStatus(pay_id);

    // Mapper le statut Lengo Pay vers le statut interne
    const nouveauStatut = STATUS_MAPPING[lengoStatus.status as keyof typeof STATUS_MAPPING] || 'EN_ATTENTE';
    const ancienStatut = remboursement.statut;

    // Forcer la synchronisation
    await updateRemboursementStatus(pay_id, nouveauStatut, lengoStatus);

    const response = {
      success: true,
      message: 'Synchronisation effectuée avec succès',
      remboursement: {
        pay_id: remboursement.pay_id,
        ancien_statut: ancienStatut,
        nouveau_statut: nouveauStatut,
        synchronise: true
      },
      lengo_status: {
        status: lengoStatus.status,
        pay_id: lengoStatus.pay_id,
        date: lengoStatus.date,
        amount: lengoStatus.amount
      }
    };

    console.log('✅ Synchronisation forcée effectuée:', response);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Erreur lors de la synchronisation forcée:', error);

    if (error.message?.includes('No rows found')) {
      return NextResponse.json({ error: 'Remboursement non trouvé' }, { status: 404 });
    }

    return NextResponse.json({
      error: 'Erreur lors de la synchronisation forcée',
      details: error.message
    }, { status: 500 });
  }
} 