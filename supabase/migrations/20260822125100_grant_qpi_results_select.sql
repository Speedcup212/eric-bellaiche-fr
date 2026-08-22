-- Allow signed-in portal users to read only the QPI result rows
-- authorized by the existing Row Level Security policies.
grant select on table public.qpi_results to authenticated;
