CREATE OR REPLACE FUNCTION public.sync_player_online_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.session_end IS NULL THEN
        -- Player started a session
        UPDATE player
        SET online = true,
            last_seen = NOW(),
            current_server_id = NEW.server_id
        WHERE minecraft_uuid = NEW.player_minecraft_uuid;
        
    ELSIF TG_OP = 'UPDATE' AND OLD.session_end IS NULL AND NEW.session_end IS NOT NULL THEN
        -- Player ended a session - check if they're still online elsewhere
        IF NOT EXISTS (
            SELECT 1 FROM player_session
            WHERE player_minecraft_uuid = NEW.player_minecraft_uuid
            AND session_end IS NULL
            AND id != NEW.id
        ) THEN
            UPDATE player
            SET online = false,
                last_seen = NEW.session_end,
                current_server_id = NULL
            WHERE minecraft_uuid = NEW.player_minecraft_uuid;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
