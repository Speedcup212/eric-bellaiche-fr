-- Crash-test wording fixes for the active investor-profile questionnaire.
-- Option codes and scoring are intentionally preserved.

begin;

update public.questionnaire_questions
set libelle = case code
  when 'Q3' then 'Avez-vous besoin de garder une partie de votre argent disponible à tout moment ?'
  when 'Q9' then 'Une perte financière pourrait-elle vous obliger à réduire vos dépenses ou reporter un projet ?'
  when 'Q10' then 'Quelle part de votre épargne pourriez-vous perdre sans difficulté financière ?'
  when 'Q11' then 'Avez-vous déjà perdu de l’argent sur un placement ?'
  when 'Q21' then 'Imaginez qu’un placement baisse de 10 %. Que faites-vous ?'
  when 'Q25' then 'Quelle part de votre épargne accepteriez-vous d’exposer à un risque de forte perte ?'
  else libelle
end
where template_id = '6cfc061d-ea5c-48cc-929c-090baf6c511a'
  and code in ('Q3','Q9','Q10','Q11','Q21','Q25');

update public.questionnaire_options o
set libelle = v.libelle
from public.questionnaire_questions q
join (values
  ('Q3','A','Oui, immédiatement'),
  ('Q3','B','Oui, dans les prochains mois'),
  ('Q3','C','Non, je peux attendre plusieurs années'),
  ('Q3','D','Je ne prévois aucun retrait'),
  ('Q4','D','Peut-être, mais rien n’est encore défini'),
  ('Q9','A','Oui, elle mettrait mon budget ou un projet essentiel en difficulté'),
  ('Q9','B','Oui, je devrais réduire ou reporter certains projets'),
  ('Q9','C','Peu : je pourrais l’absorber sans modifier mon niveau de vie'),
  ('Q9','D','Non, elle n’aurait pas d’impact important'),
  ('Q13','B','Répartir le risque entre plusieurs placements'),
  ('Q16','B','Leur valeur peut monter ou baisser et le capital n’est pas garanti'),
  ('Q17','A','Uniquement lorsque la Bourse baisse'),
  ('Q17','B','Lorsque les taux montent ou que l’emprunteur risque de ne pas rembourser'),
  ('Q17','C','Jamais si elle verse des intérêts'),
  ('Q17','D','Uniquement au moment du remboursement'),
  ('Q18','A','Une garantie totale dans tous les cas'),
  ('Q18','B','Des conditions de remboursement et un risque de perdre de l’argent'),
  ('Q18','C','Aucun risque lorsque le rendement est annoncé'),
  ('Q18','D','La possibilité de retirer son argent chaque jour sans perte'),
  ('Q20','B','Peut laisser plus de temps pour traverser les baisses, sans garantir le capital'),
  ('Q21','D','Je conserve après avoir vérifié que la stratégie reste adaptée'),
  ('Q21','E','J’investis davantage si ma situation le permet et si la stratégie reste adaptée'),
  ('Q23','D','Je conserve après avoir pris conseil'),
  ('Q23','E','Je reste serein et conserve sans changer de stratégie')
) as v(question_code, option_code, libelle)
  on q.code = v.question_code
where o.question_id = q.id
  and o.code = v.option_code
  and q.template_id = '6cfc061d-ea5c-48cc-929c-090baf6c511a';

commit;
