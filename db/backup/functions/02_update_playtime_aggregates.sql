CREATE OR REPLACE FUNCTION public.update_playtime_aggregates()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_play_date DATE;
    v_hour_start TIMESTAMP WITH TIME ZONE;
    v_hour_end TIMESTAMP WITH TIME ZONE;
    v_current_hour TIMESTAMP WITH TIME ZONE;
    v_seconds_in_hour BIGINT;
BEGIN
    -- Only process when session ends
    IF NEW.session_end IS NULL THEN
        RETURN NEW;
    END IF;

    -- Update daily aggregate
    v_play_date := NEW.session_start::DATE;
    
    -- Handle sessions that span multiple days
    WHILE v_play_date <= NEW.session_end::DATE LOOP
        INSERT INTO player_playtime_daily (player_minecraft_uuid, server_id, play_date, seconds_played)
        VALUES (
            NEW.player_minecraft_uuid,
            NEW.server_id,
            v_play_date,
            EXTRACT(EPOCH FROM (
                LEAST(NEW.session_end, (v_play_date + INTERVAL '1 day')::TIMESTAMP WITH TIME ZONE) -
                GREATEST(NEW.session_start, v_play_date::TIMESTAMP WITH TIME ZONE)
            ))::BIGINT
        )
        ON CONFLICT (player_minecraft_uuid, server_id, play_date)
        DO UPDATE SET seconds_played = player_playtime_daily.seconds_played + EXCLUDED.seconds_played;
        
        v_play_date := v_play_date + 1;
    END LOOP;

    -- Update hourly aggregates
    v_current_hour := DATE_TRUNC('hour', NEW.session_start);
    
    WHILE v_current_hour < NEW.session_end LOOP
        v_hour_start := GREATEST(NEW.session_start, v_current_hour);
        v_hour_end := LEAST(NEW.session_end, v_current_hour + INTERVAL '1 hour');
        v_seconds_in_hour := EXTRACT(EPOCH FROM (v_hour_end - v_hour_start))::BIGINT;
        
        INSERT INTO player_playtime_hourly (player_minecraft_uuid, server_id, play_hour, seconds_played)
        VALUES (NEW.player_minecraft_uuid, NEW.server_id, v_current_hour, v_seconds_in_hour)
        ON CONFLICT (player_minecraft_uuid, server_id, play_hour)
        DO UPDATE SET seconds_played = player_playtime_hourly.seconds_played + EXCLUDED.seconds_played;
        
        v_current_hour := v_current_hour + INTERVAL '1 hour';
    END LOOP;

    -- Update summary
    INSERT INTO player_playtime_summary (
        player_minecraft_uuid, 
        server_id, 
        total_seconds, 
        total_sessions,
        first_seen,
        last_seen
    )
    VALUES (
        NEW.player_minecraft_uuid,
        NEW.server_id,
        NEW.seconds_played,
        1,
        NEW.session_start,
        NEW.session_end
    )
    ON CONFLICT (player_minecraft_uuid, server_id)
    DO UPDATE SET
        total_seconds = player_playtime_summary.total_seconds + NEW.seconds_played,
        total_sessions = player_playtime_summary.total_sessions + 1,
        first_seen = LEAST(player_playtime_summary.first_seen, NEW.session_start),
        last_seen = GREATEST(player_playtime_summary.last_seen, NEW.session_end),
        updated_at = NOW();

    RETURN NEW;
END;
$function$;
