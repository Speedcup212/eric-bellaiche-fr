-- Questions QPI raccourcies : la précision réglementaire reste portée
-- par les textes d’aide de l’interface.
with wording(code, libelle) as (
  values
    ('Q3', 'Aurez-vous besoin de récupérer rapidement cette épargne ?'),
    ('Q4', 'Avez-vous un projet nécessitant de l’argent dans les 5 prochaines années ?'),
    ('Q9', 'Une baisse durable de 10 % aurait-elle un impact concret sur votre situation ?'),
    ('Q10', 'Quelle perte définitive maximale pourriez-vous supporter financièrement ?'),
    ('Q11', 'Avez-vous déjà subi une perte importante sur un placement ?'),
    ('Q12', 'Comment avez-vous réagi à votre perte la plus importante ?'),
    ('Q13', 'À quoi sert principalement la diversification ?'),
    ('Q14', 'Un rendement potentiel plus élevé implique généralement :'),
    ('Q15', 'Une SCPI ou un fonds immobilier non coté :'),
    ('Q16', 'Les unités de compte d’une assurance-vie ou d’un PER :'),
    ('Q17', 'Quand une obligation peut-elle perdre de la valeur ?'),
    ('Q18', 'Un produit structuré peut comporter :'),
    ('Q19', 'Une performance passée positive :'),
    ('Q20', 'Un placement à long terme :'),
    ('Q21', 'Votre placement de 100 000 € tombe à 90 000 €. Que faites-vous ?'),
    ('Q22', 'À partir de quelle baisse temporaire seriez-vous vraiment inquiet ?'),
    ('Q23', 'Une baisse de 20 % dure deux ans. Comment réagissez-vous ?'),
    ('Q24', 'Quelle proposition vous correspond le mieux ?'),
    ('Q25', 'Quelle part investiriez-vous dans des placements pouvant perdre plus de 30 % ?')
)
update public.questionnaire_questions qq
set libelle = wording.libelle,
    updated_at = now()
from wording
join public.questionnaire_templates qt
  on qt.code = 'QPI'
 and qt.actif = true
where qq.template_id = qt.id
  and qq.code = wording.code;
