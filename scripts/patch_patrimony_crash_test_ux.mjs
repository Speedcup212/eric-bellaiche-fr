import fs from 'node:fs';

const recueilPath = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
const journeyPath = 'src/portal/FintechJourney.tsx';

let src = fs.readFileSync(recueilPath, 'utf8');

const emptyRealEstate = `const emptyRealEstate = () => ({ type_bien: '', type_bien_autre: '', usage: '', usage_autre: '', proprietaire: '', mode_detention: '', mode_detention_autre: '', quote_part: '', valeur_actuelle: '', date_acquisition: '', prix_acquisition: '', ville: '', loyer_annuel: '', commentaire: '' });\n\n`;
if (!src.includes('const emptyRealEstate = () =>')) {
  src = src.replace('function accountFromPlacement(item: AnyPayload): AnyPayload {', emptyRealEstate + 'function accountFromPlacement(item: AnyPayload): AnyPayload {');
}

src = src.replace(
  `<JourneyProgress current="recueil" esgEnabled={forms.regulatory.esg_opt_in !== false} />\n    <PageIntro variant="recueil" eyebrow={\`Étape 1 · Partie \${step + 1}/\${sections.length}\`} title={current.title} description={current.description} />`,
  `<JourneyProgress current="recueil" esgEnabled={forms.regulatory.esg_opt_in !== false} substep={{ current: step + 1, total: sections.length, label: current.title }} />\n    {current.code !== 'patrimony' && <PageIntro variant="recueil" eyebrow={\`Étape 1 · Partie \${step + 1}/\${sections.length}\`} title={current.title} description={current.description} />}`
);

src = src.replace(
  `if (!v && (form.immobilier ?? []).length > 0 && !window.confirm('Vous avez déjà renseigné un ou plusieurs biens. Passer à « Non » supprimera ces informations. Confirmez-vous ?')) return;\n            patchCurrent({ has_real_estate: v, immobilier: v ? (form.immobilier ?? []) : [] });`,
  `if (!v && (form.immobilier ?? []).length > 0 && !window.confirm('Vous avez déjà renseigné un ou plusieurs biens. Passer à « Non » supprimera ces informations. Confirmez-vous ?')) return;\n            const existing = form.immobilier ?? [];\n            patchCurrent({ has_real_estate: v, immobilier: v ? (existing.length > 0 ? existing : [emptyRealEstate()]) : [] });`
);

src = src.replace(
  `onClick={() => patchCurrent({ immobilier: [...(form.immobilier ?? []), { type_bien: '', type_bien_autre: '', usage: '', usage_autre: '', proprietaire: '', mode_detention: '', mode_detention_autre: '', quote_part: '', valeur_actuelle: '', date_acquisition: '', prix_acquisition: '', ville: '', loyer_annuel: '', commentaire: '' }] })}`,
  `onClick={() => patchCurrent({ immobilier: [...(form.immobilier ?? []), emptyRealEstate()] })}`
);

if (!src.includes('const patrimonyReady =')) {
  src = src.replace(
    `const removeList = (key: string, index: number) => patchCurrent({ [key]: (form[key] ?? []).filter((_: unknown, i: number) => i !== index) });\n\n\n  return <div>`,
    `const removeList = (key: string, index: number) => patchCurrent({ [key]: (form[key] ?? []).filter((_: unknown, i: number) => i !== index) });\n\n  const patrimonyReady = current.code !== 'patrimony' || form.has_real_estate === false || (form.has_real_estate === true && Array.isArray(form.immobilier) && form.immobilier.length > 0 && form.immobilier.every((item: AnyPayload) => {\n    if ([item.type_bien, item.usage, item.proprietaire, item.mode_detention, item.valeur_actuelle, item.ville].some(isBlank)) return false;\n    if (item.type_bien === 'Autre' && isBlank(item.type_bien_autre)) return false;\n    if (item.usage === 'Autre' && isBlank(item.usage_autre)) return false;\n    if (item.mode_detention === 'Autre' && isBlank(item.mode_detention_autre)) return false;\n    if ((item.proprietaire === 'Les deux' || item.mode_detention === 'En indivision') && (isBlank(item.quote_part) || Number(item.quote_part) <= 0 || Number(item.quote_part) >= 100)) return false;\n    if (item.usage === 'Locatif' && isBlank(item.loyer_annuel)) return false;\n    return true;\n  }));\n\n  return <div>`
  );
}

src = src.replace(
  `<RecueilInfoNote title="Enregistrement et traçabilité"><p>Les champs marqués * sont obligatoires. Les informations fiscales et les crédits seront renseignés à partir des justificatifs transmis en fin de parcours.</p><p className="mt-1.5 text-[#aebfd4]">Chaque partie est enregistrée et horodatée. Après validation finale, vos réponses sont figées afin de préserver la piste d’audit.</p></RecueilInfoNote>`,
  `{current.code === 'patrimony' ? <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-[#CBD5E1]">Vos informations sont enregistrées de manière sécurisée.</div> : <RecueilInfoNote title="Enregistrement et traçabilité"><p>Les champs marqués * sont obligatoires. Les informations fiscales et les crédits seront renseignés à partir des justificatifs transmis en fin de parcours.</p><p className="mt-1.5 text-[#aebfd4]">Chaque partie est enregistrée et horodatée. Après validation finale, vos réponses sont figées afin de préserver la piste d’audit.</p></RecueilInfoNote>}`
);

src = src.replace(
  `disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#3B82F6]`,
  `disabled={busy || !patrimonyReady} className="inline-flex items-center gap-2 rounded-xl bg-[#3B82F6]`
);

fs.writeFileSync(recueilPath, src);

let journey = fs.readFileSync(journeyPath, 'utf8');
journey = journey.replace(
  `>{globalPct}%</div>`,
  `>{globalPct}% du parcours global</div>`
);
fs.writeFileSync(journeyPath, journey);
