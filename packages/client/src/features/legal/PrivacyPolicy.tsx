import React from "react";
import { NavLink } from "react-router";
import { PageHeader } from "@/components/page-header";
import { Separator } from "@/components/ui/separator";
import { CONTACT_EMAIL, DISCORD_INVITE_URL } from "@/lib/external-urls";

const sections = [
  {
    title: "1. Data We Collect",
    content: (
      <>
        <p>
          When you use Createrington, we may collect the following information:
        </p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>
            <strong>Discord account data</strong> — your Discord ID, username,
            and avatar (obtained via Discord OAuth using the identify scope)
          </li>
          <li>
            <strong>Minecraft account data</strong> — your Minecraft UUID and
            username, linked during the verification process
          </li>
          <li>
            <strong>Session & device data</strong> — your IP address and browser
            user agent, stored with each login session for security purposes
          </li>
          <li>
            <strong>Gameplay data</strong> — playtime (per-session, hourly,
            daily, and cumulative), online status, server activity, and full
            Minecraft statistics (blocks mined, items crafted, kills, deaths,
            advancements, etc.)
          </li>
          <li>
            <strong>Economy data</strong> — in-game currency balances, every
            balance transaction (amount, type, reason, before/after balances),
            and lottery participation
          </li>
          <li>
            <strong>Virtual trading data</strong> — token holdings, buy/sell
            transactions, pending orders (limit, stop-loss, take-profit), cost
            basis records, price alerts, watchlist selections, and daily
            portfolio value snapshots
          </li>
          <li>
            <strong>Achievement & reward data</strong> — achievements unlocked,
            tier progress, and reward claims
          </li>
          <li>
            <strong>Waitlist information</strong> — your Discord ID and
            username, queue timestamps, and queue status, recorded when you join
            the waitlist from our Discord server. No email address is collected
          </li>
          <li>
            <strong>Moderation records</strong> — strikes (with classification
            and severity), bans (temporary and permanent), and related
            administrator notes
          </li>
          <li>
            <strong>Support tickets</strong> — ticket type, messages exchanged,
            and resolution status
          </li>
          <li>
            <strong>Discord activity</strong> — guild join and leave events
            (user ID, username, timestamp) for community tracking
          </li>
          <li>
            <strong>Donation data</strong> — your Discord ID, donation amount,
            currency, donation type (one-time or monthly), Stripe session ID,
            Stripe customer ID, and Stripe subscription ID. We do not store your
            card number, billing address, or other payment details — these are
            handled entirely by Stripe
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "2. How We Use Your Data",
    content: (
      <ul className="list-disc pl-6 space-y-1">
        <li>Authenticating and identifying you across the platform</li>
        <li>Linking your Discord and Minecraft accounts for server access</li>
        <li>Tracking playtime, economy, and leaderboard statistics</li>
        <li>
          Operating the virtual trading system (executing trades, tracking
          portfolios, triggering price alerts)
        </li>
        <li>
          Assigning Discord roles automatically based on playtime, balance, and
          server tenure
        </li>
        <li>
          Managing the waitlist queue and notifying you on Discord when a spot
          opens
        </li>
        <li>
          Delivering opt-in Discord notifications (e.g., train crash alerts)
        </li>
        <li>Tracking achievements and issuing rewards</li>
        <li>Enforcing server rules and managing moderation</li>
        <li>
          Maintaining admin audit logs for accountability and transparency
        </li>
        <li>
          Processing donations and managing subscription billing via Stripe
        </li>
        <li>
          Assigning the Supporter role on Discord based on donation status
        </li>
        <li>Improving and maintaining the service</li>
      </ul>
    ),
  },
  {
    title: "3. Third-Party Services",
    content: (
      <>
        <p>We rely on the following third-party services:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>
            <strong>Discord API</strong> — for OAuth authentication, bot
            functionality, role management, and sending notifications
          </li>
          <li>
            <strong>Stripe</strong> — for processing donation payments and
            managing subscriptions. Stripe receives your payment details
            directly; we only store transaction references (session IDs,
            customer IDs, subscription IDs)
          </li>
          <li>
            <strong>Email delivery service</strong> — for sending occasional
            service emails and admin alerts
          </li>
        </ul>
        <p className="mt-2">
          These services have their own privacy policies. We recommend reviewing
          them for details on how they handle your data.
        </p>
      </>
    ),
  },
  {
    title: "4. Data Storage & Security",
    content: (
      <ul className="list-disc pl-6 space-y-1">
        <li>
          Your data is stored in a PostgreSQL database hosted on our
          infrastructure
        </li>
        <li>
          We use HTTPS for all communications between your browser and our
          servers
        </li>
        <li>
          Authentication tokens are stored as salted hashes and expire after 7
          days
        </li>
        <li>
          Access to the database and admin tools is restricted to authorized
          administrators
        </li>
        <li>
          All administrative actions are logged in an audit trail for
          accountability
        </li>
      </ul>
    ),
  },
  {
    title: "5. Data Retention",
    content: (
      <>
        <p>
          We retain your data for as long as your account is active on the
          platform. Specific retention details:
        </p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>
            <strong>Waitlist entries</strong> — marked as expired when you leave
            the queue or the Discord server; the entry itself (Discord ID,
            username and timestamps) is retained for auditing
          </li>
          <li>
            <strong>Login sessions</strong> — automatically expire after 7 days
          </li>
          <li>
            <strong>Gameplay & economy data</strong> — retained for the lifetime
            of your account
          </li>
          <li>
            <strong>Moderation records</strong> — strikes and bans may be
            removed by administrators but are retained for the duration of your
            account
          </li>
          <li>
            <strong>Donation records</strong> — retained indefinitely for
            accounting and tax purposes, even after account deletion
          </li>
        </ul>
        <p className="mt-2">
          If you request account deletion, we will remove your personal data
          within a reasonable timeframe. Some anonymized or aggregated data
          (e.g., server statistics) may be retained indefinitely.
        </p>
      </>
    ),
  },
  {
    title: "6. Data Deletion",
    content: (
      <>
        <p>
          You may request deletion of your personal data at any time. Upon
          request, we will remove your personal data from our systems within a
          reasonable timeframe.
        </p>
        {/* TODO: Add link to data deletion request form once implemented */}
        <p className="mt-2">
          To request data deletion, contact us at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          or through our{" "}
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Discord server
          </a>
          .
        </p>
      </>
    ),
  },
  {
    title: "7. Your Rights",
    content: (
      <>
        <p>You have the right to:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>
            <strong>Access</strong> — request a copy of the personal data we
            hold about you
          </li>
          <li>
            <strong>Rectification</strong> — request correction of inaccurate
            data
          </li>
          <li>
            <strong>Deletion</strong> — request removal of your personal data
            from our systems
          </li>
          <li>
            <strong>Data portability</strong> — receive your data in a
            structured, commonly used format
          </li>
        </ul>
        <p className="mt-2">
          To exercise any of these rights, contact us using the information
          below.
        </p>
      </>
    ),
  },
  {
    title: "8. Changes to This Policy",
    content: (
      <p>
        We may update this Privacy Policy from time to time. Changes will be
        posted on this page with an updated effective date. Continued use of the
        service after changes constitutes acceptance of the revised policy.
      </p>
    ),
  },
  {
    title: "9. Contact Us",
    content: (
      <p>
        If you have questions about this Privacy Policy or want to exercise your
        data rights, you can reach us at{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-primary hover:underline"
        >
          {CONTACT_EMAIL}
        </a>{" "}
        or through our{" "}
        <a
          href={DISCORD_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Discord server
        </a>
        .
      </p>
    ),
  },
];

export function PrivacyPolicy() {
  return (
    <div>
      <PageHeader
        title="Privacy Policy"
        description="How we collect, use, and protect your personal data."
        imageSrc="/assets/hero/dark-warehouse.webp"
      />

      <section className="pb-12 md:py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-5xl">
            <p className="text-sm text-muted-foreground mb-8">
              Effective date: March 28, 2026
            </p>

            <div className="flex flex-col gap-6">
              {sections.map((section, index) => (
                <React.Fragment key={section.title}>
                  {index > 0 ? <Separator className="my-2" /> : null}

                  <div>
                    <h2 className="text-foreground text-xl md:text-2xl font-semibold mb-3">
                      {section.title}
                    </h2>

                    <div className="text-muted-foreground text-base/7">
                      {section.content}
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>

            <Separator className="my-6" />

            <p className="text-sm text-muted-foreground">
              Please also review our{" "}
              <NavLink to="/terms" className="text-primary hover:underline">
                Terms of Service
              </NavLink>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
