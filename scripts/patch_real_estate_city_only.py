from pathlib import Path

path = Path('src/pages/portal/ClientRecueilJourneyBase.tsx')
text = path.read_text()

text = text.replace(", item.adresse, item.ville].some(isBlank)", ", item.ville].some(isBlank)")
text = text.replace("{ type_bien: '', usage: '', proprietaire: '', mode_detention: '', quote_part: '', valeur_actuelle: '', date_acquisition: '', prix_acquisition: '', adresse: '', code_postal: '', ville: '', loyer_annuel: '', commentaire: '' }", "{ type_bien: '', usage: '', proprietaire: '', mode_detention: '', quote_part: '', valeur_actuelle: '', date_acquisition: '', prix_acquisition: '', ville: '', loyer_annuel: '', commentaire: '' }")
text = text.replace("                <Field label=\"Adresse du bien\" required value={item.adresse} onChange={(v) => updateList('immobilier', index, { adresse: v })} placeholder=\"Numéro et voie\" />\n", "")
text = text.replace("                <Field label=\"Code postal\" value={item.code_postal} onChange={(v) => updateList('immobilier', index, { code_postal: v })} />\n", "")
text = text.replace("<p className=\"mt-1 text-sm text-slate-500\">Ajoutez chaque bien détenu, y compris la résidence principale, les biens locatifs et les résidences secondaires.</p>", "<p className=\"mt-1 text-sm text-slate-500\">Ajoutez chaque bien détenu. Seule la ville est demandée pour sa localisation.</p>")

path.write_text(text)
