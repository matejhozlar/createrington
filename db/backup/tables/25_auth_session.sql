CREATE TABLE public.auth_session (
    id              serial          PRIMARY KEY,
    discord_id      text            NOT NULL,
    discord_username text,
    discord_avatar  text,
    token_hash      text            NOT NULL UNIQUE,
    family_id       uuid            NOT NULL DEFAULT gen_random_uuid(),
    ip_address      inet,
    user_agent      text,
    revoked_at      timestamptz,
    created_at      timestamptz     NOT NULL DEFAULT now(),
    expires_at      timestamptz     NOT NULL,
    last_used_at    timestamptz     NOT NULL DEFAULT now(),

    CONSTRAINT fk_auth_session_player
        FOREIGN KEY (discord_id) REFERENCES public.player(discord_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_auth_session_discord_id  ON public.auth_session (discord_id);
CREATE INDEX idx_auth_session_token_hash  ON public.auth_session (token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_auth_session_family_id   ON public.auth_session (family_id);
CREATE INDEX idx_auth_session_expires_at  ON public.auth_session (expires_at) WHERE revoked_at IS NULL;
