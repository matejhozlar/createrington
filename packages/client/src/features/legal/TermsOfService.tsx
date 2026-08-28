import React from "react";
import { NavLink } from "react-router";
import { PageHeader } from "@/components/page-header";
import { Separator } from "@/components/ui/separator";
import { CONTACT_EMAIL, DISCORD_INVITE_URL } from "@/lib/external-urls";

const sections = [
  {
    title: "1. Acceptance of Terms",
    content: (
      <p>
        By accessing or using Createrington ("the Service"), including the
        website, Minecraft server, and Discord integrations, you agree to be
        bound by these Terms of Service. If you do not agree to these terms, do
        not use the Service.
      </p>
    ),
  },
  {
    title: "2. Eligibility & Accounts",
    content: (
      <ul className="list-disc pl-6 space-y-1">
        <li>
          You must have a valid Discord account and a legitimate Minecraft (Java
          Edition) account to use the Service
        </li>
        <li>
          You are responsible for maintaining the security of your accounts
        </li>
        <li>
          You may not share, sell, or transfer your account access to others
        </li>
        <li>We reserve the right to deny access at our sole discretion</li>
      </ul>
    ),
  },
  {
    title: "3. User Conduct",
    content: (
      <>
        <p>
          All users must follow our{" "}
          <NavLink to="/rules" className="text-primary hover:underline">
            Server Rules
          </NavLink>
          . In addition, you agree not to:
        </p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>Use the Service for any unlawful or unauthorized purpose</li>
          <li>
            Attempt to exploit, hack, or disrupt the Service or its
            infrastructure
          </li>
          <li>Impersonate other users, staff members, or administrators</li>
          <li>
            Use automated tools, bots, or scripts to interact with the Service
            without permission
          </li>
          <li>
            Engage in real-money trading (RMT) of in-game items, currency, or
            accounts
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "4. In-Game Economy",
    content: (
      <ul className="list-disc pl-6 space-y-1">
        <li>In-game currency and items have no real-world monetary value</li>
        <li>
          We reserve the right to adjust balances, reset economies, or modify
          economic systems at any time
        </li>
        <li>
          Exploiting bugs or glitches for economic gain is a violation of these
          terms
        </li>
        <li>
          Lottery participation is voluntary and uses in-game currency only
        </li>
      </ul>
    ),
  },
  {
    title: "5. Donations & Payments",
    content: (
      <>
        <p>
          Createrington accepts voluntary donations to help cover server
          hosting, infrastructure, and development costs. By making a donation,
          you acknowledge and agree:
        </p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>
            Donations are <strong>entirely voluntary</strong> and are not
            required to access or use any part of the Service
          </li>
          <li>
            All payments are processed securely through <strong>Stripe</strong>.
            We never see or store your card details, billing address, or other
            payment information
          </li>
          <li>
            Donations do not grant any in-game advantages, items, or currency.
            You will receive a <strong>Supporter role</strong> on Discord as a
            token of appreciation
          </li>
          <li>
            Monthly subscriptions may be cancelled at any time from the donate
            page or through Stripe directly. Perks remain active until the end
            of the current billing period
          </li>
          <li>
            Donations are generally <strong>non-refundable</strong>. If you
            believe a charge was made in error, please contact us and we will
            review your case
          </li>
          <li>
            Prices are listed in EUR. If your payment method uses a different
            currency, your bank may apply a conversion fee at their current
            exchange rate
          </li>
          <li>
            We reserve the right to modify donation tiers, perks, or the
            availability of the donation system at any time
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "6. Intellectual Property",
    content: (
      <>
        <p>
          The Createrington name, logo, website design, and custom server
          content are the property of the Createrington team.
        </p>
        <p className="mt-2">
          User-created builds and content on the server remain the intellectual
          property of their creators, but by building on the server you grant us
          a non-exclusive license to display, use, and distribute screenshots or
          renders of your builds for promotional purposes.
        </p>
      </>
    ),
  },
  {
    title: "7. Notifications & Communication",
    content: (
      <>
        <p>
          Certain features allow you to opt into notifications delivered via
          Discord (e.g., train crash alerts). By opting in:
        </p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>
            You consent to being mentioned in Discord messages related to the
            notification type
          </li>
          <li>You may opt out at any time by removing the associated role</li>
          <li>
            We reserve the right to add, modify, or discontinue notification
            types
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "8. Support Tickets",
    content: (
      <ul className="list-disc pl-6 space-y-1">
        <li>
          Tickets may be opened for general support or to report rule violations
        </li>
        <li>
          All ticket conversations are logged and may be reviewed by
          administrators
        </li>
        <li>
          Misuse of the ticket system (spam, false reports, or abuse) may result
          in disciplinary action
        </li>
      </ul>
    ),
  },
  {
    title: "9. Disclaimers",
    content: (
      <ul className="list-disc pl-6 space-y-1">
        <li>
          The Service is provided "as is" without warranties of any kind,
          express or implied
        </li>
        <li>
          We do not guarantee uninterrupted or error-free operation of the
          Service
        </li>
        <li>
          We are not responsible for any data loss, including in-game progress,
          due to server issues, bugs, or maintenance
        </li>
      </ul>
    ),
  },
  {
    title: "10. Limitation of Liability",
    content: (
      <p>
        To the maximum extent permitted by law, the Createrington team shall not
        be liable for any indirect, incidental, special, or consequential
        damages arising from your use of the Service. Our total liability shall
        not exceed the amount you have paid to us, if any, in the twelve months
        preceding the claim.
      </p>
    ),
  },
  {
    title: "11. Termination",
    content: (
      <>
        <p>
          We reserve the right to suspend or terminate your access to the
          Service at any time, with or without notice, for violations of these
          terms or our server rules.
        </p>
        <p className="mt-2">
          Upon termination, your right to use the Service ceases immediately.
          Provisions that by their nature should survive termination (such as
          intellectual property, disclaimers, and limitation of liability) will
          remain in effect.
        </p>
      </>
    ),
  },
  {
    title: "12. Changes to These Terms",
    content: (
      <p>
        We may update these Terms of Service from time to time. Changes will be
        posted on this page with an updated effective date. Continued use of the
        Service after changes constitutes acceptance of the revised terms.
      </p>
    ),
  },
  {
    title: "13. Contact Us",
    content: (
      <p>
        If you have questions about these Terms of Service, you can reach us at{" "}
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

export function TermsOfService() {
  return (
    <div>
      <PageHeader
        title="Terms of Service"
        description="The rules and guidelines for using Createrington."
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
              <NavLink to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </NavLink>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
