const fs=require('fs');
const p='src/pages/portal/ClientRecueilJourneyBase.tsx';
let s=fs.readFileSync(p,'utf8');
const old=`<MonthYearField required={professionalNeedsEmployer} value={String(form.date_entree ?? '')} onChange={(v) => patchCurrent({ date_entree: v })} />`;
const next=`<div className="w-full [&>div]:!border-0 [&>div]:!bg-transparent [&>div]:!p-0 [&>div]:!shadow-none"><MonthYearField required={professionalNeedsEmployer} value={String(form.date_entree ?? '')} onChange={(v) => patchCurrent({ date_entree: v })} /></div>`;
if(!s.includes(old)) throw new Error('Professional MonthYearField target not found');
s=s.replace(old,next);
fs.writeFileSync(p,s);