-- Ticket numbers were minted with MAX(ticket_number) + 1, so concurrent
-- creations could share a number. Move every duplicate above the current max
-- (the earliest row of each group keeps its number) so the unique constraint
-- below can be added. Tickets resolve by channel_id, never by number.
WITH dupe AS (
	SELECT id, row_number() OVER (ORDER BY id) AS offset_rank
	FROM ticket t
	WHERE EXISTS (
		SELECT 1
		FROM ticket o
		WHERE o.ticket_number = t.ticket_number
		  AND o.id < t.id
	)
), base AS (
	SELECT COALESCE(MAX(ticket_number), 0) AS max_number FROM ticket
)
UPDATE ticket
SET ticket_number = base.max_number + dupe.offset_rank
FROM dupe, base
WHERE ticket.id = dupe.id;--> statement-breakpoint
CREATE SEQUENCE "public"."ticket_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
-- is_called = false makes the first nextval() return exactly this value.
SELECT setval('ticket_number_seq', COALESCE((SELECT MAX(ticket_number) FROM ticket), 0) + 1, false);--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_ticket_number_unique" UNIQUE("ticket_number");
