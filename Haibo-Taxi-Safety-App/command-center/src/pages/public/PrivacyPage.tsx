import React from "react";
import { LegalLayout, LegalSection, P, UL, LI, Term } from "../../components/LegalLayout";
import { usePageMeta } from "../../hooks/usePageMeta";
import { colors, radius, spacing } from "../../lib/brand";

const LAST_UPDATED = "15 April 2026";

export function PrivacyPage() {
  usePageMeta({
    title: "Privacy Policy — Haibo!",
    description:
      "How Haibo! collects, uses, and protects your personal information in line with the Protection of Personal Information Act (POPIA) of South Africa.",
  });

  return (
    <LegalLayout
      eyebrow="Privacy policy"
      title="How we handle your data."
      lastUpdated={LAST_UPDATED}
      plainSummary="We collect the minimum we need to keep you safe, let you pay drivers, and run the community. We never sell your data. You can ask for a copy or deletion at any time."
      sections={SECTIONS}
    />
  );
}

const SECTIONS: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <P>
          <Term>Haibo! Africa</Term> (we, us, our) operates the Haibo! mobile app
          and the Haibo! Command Center at app.haibo.africa. We are a South
          African-based company building safety, payment, and community tools for
          the minibus taxi industry.
        </P>
        <P>
          For the purposes of the Protection of Personal Information Act, 2013
          (POPIA), Haibo! Africa is the <Term>Responsible Party</Term> for the
          personal information we process about you.
        </P>
        <P>
          Our Information Officer can be contacted at{" "}
          <a href="mailto:privacy@haibo.africa" style={{ color: colors.rose, fontWeight: 600 }}>
            privacy@haibo.africa
          </a>
          . For day-to-day support and general questions, please use{" "}
          <a href="mailto:support@haibo.africa" style={{ color: colors.rose, fontWeight: 600 }}>
            support@haibo.africa
          </a>
          .
        </P>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <>
        <P>
          We try to collect the minimum information we need to run each feature.
          Here's the full list:
        </P>
        <UL>
          <LI>
            <Term>Account information:</Term> your phone number (required), name,
            email (optional), and profile photo (optional). We need your phone
            number to send you the one-time code you use to sign in, and to let
            other users find or pay you inside Haibo!.
          </LI>
          <LI>
            <Term>Location:</Term> your approximate and precise GPS location while
            you use the app. This is what powers the rank finder, route tracking,
            group rides, and — most importantly — sending your coordinates when
            you trigger an SOS. You can revoke location access at any time in
            your phone settings. Some features stop working without it.
          </LI>
          <LI>
            <Term>Emergency contact:</Term> one phone number you nominate as your
            primary emergency contact. We only use this number to forward your
            SOS alerts.
          </LI>
          <LI>
            <Term>Driver and vendor documents:</Term> if you register as a driver,
            fleet owner, or Haibo! Vault vendor, we collect your driver's license,
            PrDP, taxi permit, vehicle registration, and business documents for
            verification. These are stored encrypted and only reviewed by our
            moderation team.
          </LI>
          <LI>
            <Term>Payment information:</Term> when you top up your Haibo! Pay
            wallet or send money to another user, we process the transaction
            through Paystack, our payment partner. We store a record of the
            amount, date, and counterparty, but <Term>we never store your full
            card number or CVV</Term> — Paystack handles that directly.
          </LI>
          <LI>
            <Term>Community content:</Term> posts, photos, ratings, route
            submissions, lost-and-found reports, and event RSVPs you create.
            These are visible to other users by design — that's the point.
          </LI>
          <LI>
            <Term>Usage data:</Term> crash reports, basic analytics (which screens
            you visit, how often), and the device model and OS version. We use
            this to fix bugs and prioritize improvements.
          </LI>
          <LI>
            <Term>SOS event history:</Term> every SOS you trigger is logged in an
            immutable audit table with your coordinates, the taxi plate (if
            known), and who was dispatched. This exists so you have a record
            and so emergency responders can reference prior incidents.
          </LI>
        </UL>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use your data",
    body: (
      <>
        <P>
          We use your information for the specific purposes listed below. We do
          not use your data for anything else without asking you first.
        </P>
        <UL>
          <LI>
            <Term>To keep you safe.</Term> Triggering SOS, dispatching your
            location to your emergency contact and local responders, logging the
            event to our audit table.
          </LI>
          <LI>
            <Term>To run the product features you use.</Term> Finding nearby
            ranks, tracking routes, coordinating group rides, processing wallet
            top-ups and peer transfers, verifying drivers and vendors.
          </LI>
          <LI>
            <Term>To communicate with you.</Term> Sending OTP codes, transactional
            SMS for wallet activity, push notifications for community alerts you
            opted into, replies to support requests.
          </LI>
          <LI>
            <Term>To moderate the community.</Term> Reviewing reported content,
            verifying driver KYC, investigating complaints about overcharging,
            harassment, or unsafe driving.
          </LI>
          <LI>
            <Term>To improve Haibo!.</Term> Fixing crashes, prioritizing feature
            work, understanding which safety features are used most.
          </LI>
          <LI>
            <Term>To comply with the law.</Term> Responding to lawful requests
            from SAPS, courts, or the Information Regulator, and meeting our
            financial services obligations for wallet and payment activity.
          </LI>
        </UL>
      </>
    ),
  },
  {
    id: "legal-basis",
    title: "Legal basis under POPIA",
    body: (
      <>
        <P>
          POPIA requires us to have a lawful justification for processing your
          personal information. We rely on one of the following in each case:
        </P>
        <UL>
          <LI>
            <Term>Your consent</Term> — for optional features like community
            posting, profile photos, and marketing communications. You give
            consent the first time you use each feature, and you can withdraw
            consent at any time.
          </LI>
          <LI>
            <Term>Performance of a contract</Term> — for processing related to
            your account, wallet, and the core product features you signed up
            for.
          </LI>
          <LI>
            <Term>Legitimate interest</Term> — for safety-critical features (SOS,
            rank finder, route tracking) and for fraud prevention. We believe
            the benefit to commuter safety clearly outweighs any minimal privacy
            cost.
          </LI>
          <LI>
            <Term>Legal obligation</Term> — for record-keeping required by the
            Financial Intelligence Centre Act (FICA) and other SA financial
            regulations.
          </LI>
        </UL>
      </>
    ),
  },
  {
    id: "who-we-share",
    title: "Who we share your data with",
    body: (
      <>
        <P>
          We <Term>never sell your personal information</Term>. Full stop.
        </P>
        <P>
          We do share specific pieces of your data with the following categories
          of third parties, only for the purposes listed:
        </P>
        <UL>
          <LI>
            <Term>Paystack (Pty) Ltd</Term> — payment processing for Haibo! Pay.
            Paystack is PCI DSS compliant and handles all card data directly.
            See paystack.com/za/privacy.
          </LI>
          <LI>
            <Term>Google Firebase</Term> — push notifications and crash reporting.
            Your device token and crash stack traces are processed by Google.
          </LI>
          <LI>
            <Term>Microsoft Azure</Term> — our server, database, and file storage
            are hosted on Azure in the South Africa North region. Azure does not
            access the data we store; it provides the infrastructure.
          </LI>
          <LI>
            <Term>Azure Communication Services</Term> — sending SMS (OTP codes,
            SOS alerts to your emergency contact).
          </LI>
          <LI>
            <Term>Mapbox and Google Maps</Term> — map rendering and geocoding.
            Your coordinates are sent to these services when you look at the
            map or search for a place.
          </LI>
          <LI>
            <Term>Emergency responders and your nominated emergency contact</Term>{" "}
            — only when you trigger an SOS. We share your name, phone, location,
            and message with the contact and responder you have nominated or
            the app has dispatched to.
          </LI>
          <LI>
            <Term>Law enforcement and regulators</Term> — only when we receive a
            lawful request (warrant, court order, regulator directive) that we
            are required to respond to under SA law.
          </LI>
        </UL>
        <P>
          We review each third party's privacy practices annually and terminate
          relationships with any that fall out of compliance.
        </P>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep your data",
    body: (
      <>
        <P>
          We keep your information only for as long as we need it for the
          purpose we collected it, or as required by law:
        </P>
        <UL>
          <LI>
            <Term>Account data</Term> — until you delete your account, plus 30
            days to allow for recovery and final reconciliation.
          </LI>
          <LI>
            <Term>Location history</Term> — continuous location is never stored.
            Location points collected during an active ride or SOS event are
            kept for 90 days, then aggregated and anonymized for route quality.
          </LI>
          <LI>
            <Term>Wallet transactions</Term> — 5 years, as required by the
            Financial Intelligence Centre Act.
          </LI>
          <LI>
            <Term>SOS audit log</Term> — 7 years, for incident review and
            law enforcement cooperation.
          </LI>
          <LI>
            <Term>Driver / vendor KYC documents</Term> — for as long as the
            driver or vendor is active plus 5 years after account closure, per
            FICA.
          </LI>
          <LI>
            <Term>Community posts</Term> — indefinitely, unless you delete them
            or a moderator removes them. Hidden content is kept for 1 year in
            case of dispute.
          </LI>
          <LI>
            <Term>Crash and analytics data</Term> — 90 days, then aggregated.
          </LI>
        </UL>
      </>
    ),
  },
  {
    id: "storage",
    title: "Where your data is stored",
    body: (
      <>
        <P>
          Your data is stored in Microsoft Azure's <Term>South Africa North</Term>{" "}
          region (Johannesburg). This means your personal information stays
          inside South Africa and is subject to South African law.
        </P>
        <P>
          Some of our third parties (Paystack, Firebase, Google Maps) may process
          small pieces of your data outside South Africa. We only work with
          providers who offer equivalent data protection standards and who have
          standard contractual clauses in place for international transfers.
        </P>
      </>
    ),
  },
  {
    id: "protection",
    title: "How we protect your data",
    body: (
      <>
        <P>
          We take the security of your information seriously. Our safeguards
          include:
        </P>
        <UL>
          <LI>
            <Term>Encryption in transit</Term> — every request between the app
            and our servers uses TLS 1.2 or higher.
          </LI>
          <LI>
            <Term>Encryption at rest</Term> — databases, backups, and storage
            are encrypted by Azure.
          </LI>
          <LI>
            <Term>Password hashing</Term> — passwords are hashed with bcrypt.
            We can never see your plaintext password.
          </LI>
          <LI>
            <Term>Role-based access</Term> — only specific members of our team
            can access personal data, and only for the purposes above.
          </LI>
          <LI>
            <Term>Rate limiting and fraud detection</Term> — on authentication,
            OTP, wallet transfers, and SOS to prevent abuse.
          </LI>
          <LI>
            <Term>Audit logging</Term> — every administrative action in our
            Command Center is logged with the admin's identity and timestamp.
          </LI>
        </UL>
        <P>
          No system is perfectly secure. If we become aware of a breach that
          affects your personal information, we will notify you and the
          Information Regulator without undue delay, as POPIA requires.
        </P>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights under POPIA",
    body: (
      <>
        <P>
          Under POPIA, you have the following rights about your personal
          information:
        </P>
        <UL>
          <LI>
            <Term>Right of access</Term> — you can ask us to give you a copy of
            the data we hold about you.
          </LI>
          <LI>
            <Term>Right to correction</Term> — you can ask us to fix inaccurate
            or incomplete data.
          </LI>
          <LI>
            <Term>Right to deletion</Term> — you can ask us to delete your data,
            subject to our retention obligations (for example, we may need to
            keep FICA-regulated wallet records even after you delete your
            account).
          </LI>
          <LI>
            <Term>Right to object</Term> — you can object to specific types of
            processing, especially marketing.
          </LI>
          <LI>
            <Term>Right to withdraw consent</Term> — you can withdraw consent
            for any feature that relies on it, without affecting processing we
            did before you withdrew.
          </LI>
          <LI>
            <Term>Right to complain</Term> — you can lodge a complaint with the
            Information Regulator if you believe we have not respected these
            rights.
          </LI>
        </UL>
      </>
    ),
  },
  {
    id: "exercise-rights",
    title: "How to exercise your rights",
    body: (
      <>
        <P>
          Email{" "}
          <a href="mailto:privacy@haibo.africa" style={{ color: colors.rose, fontWeight: 600 }}>
            privacy@haibo.africa
          </a>{" "}
          with the request. Include your registered phone number so we can
          verify the account. We will respond within <Term>30 days</Term>,
          as POPIA requires, or sooner if the request is simple.
        </P>
        <P>
          We will ask for a government-issued ID before processing access or
          deletion requests. This is to stop someone else from impersonating
          you and taking control of your data.
        </P>
        <P>
          There is no charge for exercising your POPIA rights. If a request is
          manifestly unfounded or excessive (for example, repeated requests
          about the same data within a short period), we may charge a
          reasonable administrative fee or refuse the request, and we will
          explain why.
        </P>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and tracking",
    body: (
      <>
        <P>
          The Haibo! mobile app does not use cookies. It stores a small amount
          of state on your device (your login token, onboarding progress,
          offline cache of taxi ranks) using the operating system's secure
          storage.
        </P>
        <P>
          The app.haibo.africa website uses only first-party, essential cookies
          needed to keep you signed in to the Command Center and to remember
          your preferences. We do not use third-party advertising cookies or
          cross-site tracking pixels.
        </P>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <>
        <P>
          Haibo! is not designed for children under <Term>18</Term>. We do not
          knowingly collect personal information from children. If you believe
          we have collected data from someone under 18, please email{" "}
          <a href="mailto:privacy@haibo.africa" style={{ color: colors.rose, fontWeight: 600 }}>
            privacy@haibo.africa
          </a>{" "}
          and we will delete it.
        </P>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <>
        <P>
          We may update this privacy policy when we add features, change third
          parties, or when the law changes. The "Last updated" date at the top
          reflects the most recent revision.
        </P>
        <P>
          For material changes — for example, a new category of data collection
          or a new third party — we will notify you in the app before the
          change takes effect. If you don't agree, you can delete your account
          before the change applies.
        </P>
      </>
    ),
  },
  {
    id: "complaints",
    title: "Complaints and the Information Regulator",
    body: (
      <>
        <P>
          If you are unhappy with how we handle your personal information,
          please start by contacting us at{" "}
          <a href="mailto:privacy@haibo.africa" style={{ color: colors.rose, fontWeight: 600 }}>
            privacy@haibo.africa
          </a>
          . We'll do our best to resolve the issue quickly.
        </P>
        <P>
          You can also lodge a complaint directly with the Information Regulator
          of South Africa:
        </P>
        <div
          style={{
            padding: spacing.lg,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            background: colors.surfaceAlt,
            fontSize: 14,
            lineHeight: 1.7,
            color: colors.textSecondary,
          }}
        >
          <strong style={{ color: colors.text }}>Information Regulator (South Africa)</strong>
          <br />
          JD House, 27 Stiemens Street, Braamfontein, Johannesburg, 2001
          <br />
          Email:{" "}
          <a
            href="mailto:POPIAComplaints@inforegulator.org.za"
            style={{ color: colors.rose }}
          >
            POPIAComplaints@inforegulator.org.za
          </a>
          <br />
          Web:{" "}
          <a
            href="https://inforegulator.org.za"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: colors.rose }}
          >
            inforegulator.org.za
          </a>
        </div>
      </>
    ),
  },
];
