CREATE TYPE public.waitlist_status AS ENUM (
    'pending',
    'accepted',
    'declined',
    'completed'
);
