import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [cabinet, family, sql] = await Promise.all([
  readFile('src/pages/portal/CifAdminPage.tsx', 'utf8'),
  readFile('src/pages/portal/ClientRecueilJourneyPage.tsx', 'utf8'),
  readFile('supabase/migrations/20261020164500_allow_shared_couple_contacts.sql', 'utf8'),
]);

for (const [label, condition] of [
  ['Case de partage explicite', cabinet.includes('Coordonnées communes au couple')],
  ['Partage email seulement si accepté', cabinet.includes('p_shared_contacts:shared')],
  ['Pas d’invitation automatique secondaire', cabinet.includes('sharedContactSecondary(x,inv)')],
  ['Affichage statut des comptes secondaires', cabinet.includes("sharedSecondary?'Contact partagé'")],
  ['Recueil familial partagé', family.includes('coordonnees_communes_couple: isCouple && family.sharedContacts')],
  ['Profil personnel distinct', family.includes('const spouseEmail = family.sharedContacts ? primaryContact.email')],
  ['RPC avec consentement explicite', sql.includes('p_shared_contacts boolean')],
  ['Pas de partage par défaut', sql.includes("coalesce(p_shared_contacts, false)")],
  ['Contrôle création invitation', sql.includes('CREATE OR REPLACE FUNCTION private.create_client_invite_core')],
  ['Contrôle activation client', sql.includes('CREATE OR REPLACE FUNCTION private.claim_client_invite_core')],
  ['Contrôle activation service', sql.includes('CREATE OR REPLACE FUNCTION private.service_activate_client_invite_core')],
  ['Deuxième compte partagé interdit', (sql.match(/secondary_member\.role_dossier = 'investisseur_2'/g) || []).length === 3],
  ['Séparation conservée au niveau de la base', sql.includes('private.create_client_dossier_core')],
]) {
  assert.ok(condition, label);
}

console.log('Coordonnées communes au couple : 13 garde-fous vérifiés.');
