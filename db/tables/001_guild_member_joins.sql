-- Migration: Create guild_member_joins table
-- This table tracks the order in which members join the guild
-- Each member gets a unique, persistent join number

CREATE TABLE IF NOT EXISTS guild_member_joins (
    -- Auto-incrementing join number (this is what shows in the welcome image)
    join_number SERIAL PRIMARY KEY,
    
    -- Discord user ID 
    user_id VARCHAR(19) NOT NULL UNIQUE,
    
    -- Discord username at time of join
    username VARCHAR(32) NOT NULL,
    
    -- Timestamp when user joined
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Index for faster lookups by user_id
    CONSTRAINT idx_user_id UNIQUE (user_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_guild_member_joins_joined_at 
    ON guild_member_joins(joined_at DESC);

-- Add comment to table
COMMENT ON TABLE guild_member_joins IS 
    'Tracks guild member join order with persistent sequential numbers';

COMMENT ON COLUMN guild_member_joins.join_number IS 
    'Unique sequential number assigned to each member (shown in welcome image)';

COMMENT ON COLUMN guild_member_joins.user_id IS 
    'Discord user snowflake ID';

COMMENT ON COLUMN guild_member_joins.username IS 
    'Username at the time of joining (for historical reference)';

COMMENT ON COLUMN guild_member_joins.joined_at IS 
    'Timestamp when the member joined the guild';