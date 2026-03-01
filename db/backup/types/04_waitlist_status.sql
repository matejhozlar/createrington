CREATE TYPE public.waitlist_status AS ENUM (
    'pending',
    'auto_accepted',
    'accepted',
    'declined',
    'completed'
);
