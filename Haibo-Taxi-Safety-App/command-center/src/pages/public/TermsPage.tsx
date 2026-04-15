import React from "react";
import { AlertOctagon } from "lucide-react";
import { LegalLayout, LegalSection, P, UL, LI, Term } from "../../components/LegalLayout";
import { usePageMeta } from "../../hooks/usePageMeta";
import { colors, radius, spacing, fonts } from "../../lib/brand";

const LAST_UPDATED = "15 April 2026";

export function TermsPage() {
  usePageMeta({
    title: "Terms of Service — Haibo!",
    description:
      "The terms that govern your use of the Haibo! mobile app and Command Center. Includes the important safety disclaimer that Haibo! is not a substitute for emergency services.",
  });

  return (
    <LegalLayout
      eyebrow="Terms of service"
      title="The rules of the road."
      lastUpdated={LAST_UPDATED}
      plainSummary="Here's what you can expect from us, what we expect from you, and the one thing we need you to understand before anything else: Haibo! is not a replacement for 10111 or 112."
      sections={SECTIONS}
      criticalCallout={<SafetyCallout />}
    />
  );
}

function SafetyCallout() {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        gap: spacing.lg,
        padding: spacing["2xl"],
        background: colors.dangerSoft,
        border: `2px solid ${colors.danger}`,
        borderRadius: radius.xl,
        marginBottom: spacing["2xl"],
      }}
    >
      <AlertOctagon
        size={28}
        color={colors.danger}
        strokeWidth={2.4}
        style={{ flexShrink: 0, marginTop: 2 }}
      />
      <div>
        <div
          style={{
            fontFamily: fonts.heading,
            fontSize: 18,
            fontWeight: 700,
            color: colors.danger,
            marginBottom: spacing.xs,
          }}
        >
          Haibo! is not a substitute for emergency services.
        </div>
        <div
          style={{
            fontSize: 14.5,
            lineHeight: 1.65,
            color: colors.text,
          }}
        >
          If you are in immediate danger, call <strong>10111</strong> (SAPS) or{" "}
          <strong>10177</strong> (ambulance) first. Haibo!'s SOS feature is a
          complementary tool designed to alert your emergency contact and, where
          available, local community responders — it is <strong>best-effort</strong> and{" "}
          <strong>not a guaranteed response service</strong>. We do not dispatch
          police, paramedics, or armed response. We cannot guarantee delivery of
          SOS alerts in areas with no mobile signal, during network outages, or
          if your phone is damaged. By using Haibo! you acknowledge this
          limitation and accept that the primary responsibility for your safety
          rests with you and the official emergency services.
        </div>
      </div>
    </div>
  );
}

const SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement",
    body: (
      <>
        <P>
          These terms of service form a binding agreement between you and{" "}
          <Term>Haibo! Africa</Term> (we, us, our). By downloading, installing,
          or using the Haibo! mobile app or the Haibo! Command Center at
          app.haibo.africa, you agree to these terms.
        </P>
        <P>
          If you don't agree, please uninstall the app and stop using our
          services. You can email{" "}
          <a href="mailto:support@haibo.africa" style={{ color: colors.rose, fontWeight: 600 }}>
            support@haibo.africa
          </a>{" "}
          to have your account deleted.
        </P>
        <P>
          These terms should be read alongside our{" "}
          <a href="/privacy" style={{ color: colors.rose, fontWeight: 600 }}>
            Privacy Policy
          </a>
          , which explains how we handle your personal information under POPIA.
        </P>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Eligibility",
    body: (
      <>
        <P>To use Haibo! you must:</P>
        <UL>
          <LI>Be at least 18 years old.</LI>
          <LI>
            Have the legal capacity to enter into a contract under South African
            law.
          </LI>
          <LI>
            Provide accurate, current, and complete information when you
            register, and keep it up to date.
          </LI>
          <LI>
            Not be barred from using our services by a court order or regulatory
            decision.
          </LI>
        </UL>
        <P>
          If you register as a <Term>driver</Term>, <Term>fleet owner</Term>,
          or <Term>Haibo! Vault vendor</Term>, additional requirements apply.
          These are set out in the specific onboarding flow and include valid
          licensing, clean driving records, and KYC verification.
        </P>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <>
        <P>
          You sign in to Haibo! using your mobile phone number and a one-time
          code. You are responsible for keeping your phone and your OTP codes
          secure. Anyone who has access to your phone can access your Haibo!
          account, including your wallet and SOS contact.
        </P>
        <P>
          You must notify us immediately at{" "}
          <a href="mailto:support@haibo.africa" style={{ color: colors.rose, fontWeight: 600 }}>
            support@haibo.africa
          </a>{" "}
          if you believe someone else has accessed your account. We will help
          you lock it down and investigate.
        </P>
        <P>
          You may only register one account per person. Creating multiple
          accounts or using someone else's identity is a breach of these terms
          and may result in immediate termination.
        </P>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <P>You agree that you will not:</P>
        <UL>
          <LI>
            Use Haibo! for any unlawful purpose or to facilitate illegal activity.
          </LI>
          <LI>
            Trigger false SOS alerts. The SOS feature is for real emergencies
            only. False alarms waste responder time and endanger people with
            genuine emergencies.
          </LI>
          <LI>
            Harass, threaten, impersonate, or defame other users, drivers, or
            our moderators.
          </LI>
          <LI>
            Post or share content that is illegal, hateful, pornographic,
            discriminatory, or incites violence.
          </LI>
          <LI>
            Upload malware, exploit vulnerabilities, scrape our API beyond
            reasonable rate limits, or attempt to reverse-engineer the app.
          </LI>
          <LI>
            Use Haibo! to commit fraud — including fake wallet transfers, fake
            ride claims, or bogus community reports designed to manipulate
            ratings.
          </LI>
          <LI>
            Share your account or OTP codes with anyone else.
          </LI>
        </UL>
        <P>
          We reserve the right to suspend or terminate accounts that violate
          this section, remove offending content, and report serious violations
          to law enforcement.
        </P>
      </>
    ),
  },
  {
    id: "sos-feature",
    title: "The SOS feature",
    body: (
      <>
        <P>
          Read this section carefully. It explains exactly what the SOS feature
          does, what it does not do, and the limitations you need to understand.
        </P>
        <P>
          <Term>What SOS does:</Term> When you trigger an SOS, Haibo! sends an
          SMS to your nominated emergency contact with your current GPS
          coordinates and a pre-configured message. It also notifies our
          Command Center moderators, who may forward the alert to local
          community responders where such responders exist and are available.
          The event is logged to an immutable audit table.
        </P>
        <P>
          <Term>What SOS does not do:</Term>
        </P>
        <UL>
          <LI>
            It does <strong>not</strong> dispatch SAPS, private security, or
            ambulance services. You must do that through official channels
            (10111, 10177, 112 from a mobile).
          </LI>
          <LI>
            It does <strong>not</strong> guarantee that your message will be
            received. SMS delivery depends on the mobile network, cell tower
            coverage, and the recipient's device being on and in range.
          </LI>
          <LI>
            It does <strong>not</strong> guarantee a response time. Community
            responders are volunteers; we cannot promise availability.
          </LI>
          <LI>
            It does <strong>not</strong> work without location permission and a
            working mobile data or SMS connection.
          </LI>
          <LI>
            It does <strong>not</strong> work if your phone is off, damaged, or
            out of battery.
          </LI>
        </UL>
        <P>
          By using SOS, you acknowledge and accept these limitations, and agree
          that Haibo! is not liable for any harm resulting from non-delivery,
          delay, or unavailability of emergency response. Always call 10111 or
          10177 first in a life-threatening situation.
        </P>
      </>
    ),
  },
  {
    id: "wallet",
    title: "Haibo! Pay and payments",
    body: (
      <>
        <P>
          Haibo! Pay is a digital wallet that lets you top up a balance, pay
          drivers and vendors, and send money to other users. Wallet balances
          are held by our payment partner{" "}
          <Term>Paystack (Pty) Ltd</Term> — we do not act as a bank.
        </P>
        <P>
          All card payments and top-ups are processed by Paystack. Haibo!
          does not see or store your card details. By making a payment, you
          also agree to Paystack's terms of service.
        </P>
        <P>
          You agree that:
        </P>
        <UL>
          <LI>
            You will only use Haibo! Pay with funds you are legally entitled to
            use.
          </LI>
          <LI>
            Wallet transfers are generally final. Requests to reverse a completed
            transfer are considered on a case-by-case basis and are not
            guaranteed — especially if the funds have already been withdrawn by
            the recipient.
          </LI>
          <LI>
            Withdrawals to a bank account are subject to review and may be
            delayed if our fraud systems flag them. We will contact you if we
            need more information.
          </LI>
          <LI>
            We may freeze a wallet if we reasonably suspect fraud, money
            laundering, or breach of these terms. A frozen wallet will be
            investigated within 5 business days.
          </LI>
          <LI>
            You are responsible for any fees charged by your bank or mobile
            network provider for transactions.
          </LI>
        </UL>
        <P>
          Haibo! complies with the Financial Intelligence Centre Act (FICA) and
          related anti-money-laundering regulations. We may request additional
          verification documents for large or frequent transactions.
        </P>
      </>
    ),
  },
  {
    id: "community",
    title: "Community content and moderation",
    body: (
      <>
        <P>
          The Haibo! community feed, ratings, lost-and-found board, and route
          submissions are user-generated. When you post, you keep ownership of
          your content, but you grant us a non-exclusive, royalty-free licence
          to display, distribute, and store that content inside the Haibo!
          ecosystem.
        </P>
        <P>
          We operate a <Term>reactive moderation</Term> model: your content goes
          live immediately, and our moderators review reported or flagged posts
          after the fact. We will remove content that breaks our acceptable-use
          rules, but we do not pre-screen most posts. This means you will
          sometimes see content that hasn't been reviewed yet. If you see
          something that breaks the rules, tap the report button.
        </P>
        <P>
          The two exceptions to reactive moderation are <Term>driver KYC</Term>{" "}
          and <Term>Haibo! Vault vendor onboarding</Term>. Both require admin
          verification before the driver or vendor is marked as verified.
        </P>
        <P>
          We are not responsible for the accuracy of user-generated content.
          Rank status, route information, fare estimates, and community posts
          are crowdsourced. Verify independently before relying on them for
          safety decisions.
        </P>
      </>
    ),
  },
  {
    id: "drivers-vendors",
    title: "Drivers, fleet owners, and vendors",
    body: (
      <>
        <P>
          If you register as a driver or fleet owner, you confirm that you hold
          a valid Professional Driving Permit (PrDP), the taxi you operate is
          roadworthy, and you are legally permitted to carry passengers. You
          will keep your documents current.
        </P>
        <P>
          If you register as a Haibo! Vault vendor, you confirm that your
          business is lawful and you will comply with all applicable tax,
          licensing, and health regulations.
        </P>
        <P>
          We verify your documents during onboarding, but verification is a
          point-in-time check. You remain responsible for the legality and
          quality of your service. We may suspend or terminate driver / vendor
          accounts for repeated complaints, expired documents, or confirmed
          misconduct.
        </P>
      </>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <>
        <P>
          Haibo! is provided <Term>"as is"</Term> and <Term>"as available"</Term>.
          We do our best to keep the service running well, but we do not
          guarantee that it will always be available, error-free, or fit for
          any particular purpose.
        </P>
        <P>
          To the maximum extent permitted by South African law, Haibo! Africa
          and its directors, employees, and partners are <strong>not liable</strong>{" "}
          for:
        </P>
        <UL>
          <LI>
            Any loss or harm resulting from non-delivery, delay, or failure of
            SOS alerts or emergency response.
          </LI>
          <LI>
            Accidents, injury, or property loss occurring during a ride, group
            ride, or community-organized event, whether booked through Haibo! or
            otherwise.
          </LI>
          <LI>
            Disputes between you and other users, drivers, vendors, or third
            parties — including payment disputes, ride refusals, or content
            disputes.
          </LI>
          <LI>
            Errors in user-generated content, including inaccurate rank
            information, fare estimates, or route data.
          </LI>
          <LI>
            Loss of wallet funds caused by unauthorized access to your device
            or OTP codes.
          </LI>
          <LI>
            Indirect, incidental, consequential, or punitive damages arising
            from your use of the service.
          </LI>
        </UL>
        <P>
          Nothing in these terms limits liability that cannot be limited under
          South African law, including the Consumer Protection Act where it
          applies.
        </P>
      </>
    ),
  },
  {
    id: "indemnity",
    title: "Indemnity",
    body: (
      <>
        <P>
          You agree to indemnify and hold Haibo! Africa harmless from any claim,
          loss, liability, or expense (including reasonable legal fees)
          resulting from your breach of these terms, your misuse of the service,
          your content, or your violation of another user's rights.
        </P>
      </>
    ),
  },
  {
    id: "termination",
    title: "Suspension and termination",
    body: (
      <>
        <P>
          You may delete your account at any time through the app's Settings
          screen or by emailing{" "}
          <a href="mailto:support@haibo.africa" style={{ color: colors.rose, fontWeight: 600 }}>
            support@haibo.africa
          </a>
          .
        </P>
        <P>
          We may suspend or terminate your account if you breach these terms,
          if we reasonably suspect fraud or abuse, if required by law, or if we
          decide to discontinue a feature or the service entirely. Where
          possible we will give you notice; where not (for example, serious
          misconduct) we may act immediately.
        </P>
        <P>
          Terminating your account closes access to your wallet balance. We
          will release any remaining balance to your nominated bank account
          after completing standard fraud and FICA checks.
        </P>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <>
        <P>
          We may update these terms when we add features, change how something
          works, or when the law changes. The "Last updated" date at the top
          reflects the most recent revision.
        </P>
        <P>
          For material changes, we will notify you inside the app before the
          change takes effect. If you keep using Haibo! after a material change,
          you are agreeing to the new terms. If you don't agree, you can delete
          your account.
        </P>
      </>
    ),
  },
  {
    id: "governing-law",
    title: "Governing law and disputes",
    body: (
      <>
        <P>
          These terms are governed by the laws of the <Term>Republic of South
          Africa</Term>. Any dispute that arises from or relates to these terms
          or your use of Haibo! will be subject to the exclusive jurisdiction
          of the South African courts.
        </P>
        <P>
          Before going to court, we ask that you first contact us at{" "}
          <a href="mailto:support@haibo.africa" style={{ color: colors.rose, fontWeight: 600 }}>
            support@haibo.africa
          </a>
          . Most issues can be resolved quickly if we talk them through.
        </P>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <>
        <P>
          For general support:{" "}
          <a href="mailto:support@haibo.africa" style={{ color: colors.rose, fontWeight: 600 }}>
            support@haibo.africa
          </a>
        </P>
        <P>
          For privacy and data requests:{" "}
          <a href="mailto:privacy@haibo.africa" style={{ color: colors.rose, fontWeight: 600 }}>
            privacy@haibo.africa
          </a>
        </P>
        <P>
          For legal notices:{" "}
          <a href="mailto:legal@haibo.africa" style={{ color: colors.rose, fontWeight: 600 }}>
            legal@haibo.africa
          </a>
        </P>
      </>
    ),
  },
];
