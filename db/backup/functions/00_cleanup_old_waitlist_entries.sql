CREATE OR REPLACE FUNCTION public.cleanup_old_waitlist_entries()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    DELETE FROM waitlist_entry
    WHERE submitted_at < NOW() - INTERVAL '30 days';
END;
$function$;
