import LegalPage from "@/components/LegalPage";

const Privacy = () => (
  <LegalPage
    kind="privacy"
    title="Privacy Policy"
    intro="Your privacy matters. This policy explains what data we collect, how we use it, and the choices you have. We do not sell your data — ever."
    sections={[
      {
        title: "Information We Collect",
        body: (
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Account details: Pharmacy Name, email, password (hashed).</li>
            <li>Menu data, table configuration, bank details (for payouts).</li>
            <li>Order history, customer chat messages, and payment screenshots uploaded by your customers.</li>
            <li>Standard usage data (browser, IP, device) for security and service improvement.</li>
          </ul>
        ),
      },
      {
        title: "How We Use Data",
        body: (
          <p>To operate the service, process payments, prevent abuse, and improve features. Customer order data and uploaded screenshots are stored on your behalf — they belong to your pharmacy.</p>
        ),
      },
      {
        title: "Sharing",
        body: (
          <p>We do not sell your data. We share information only with infrastructure providers (hosting, database, storage) under strict confidentiality, and when required by law.</p>
        ),
      },
      {
        title: "Security",
        body: (
          <p>We use industry-standard encryption (in transit and at rest), access controls and audited backups to protect your information. No system is 100% secure — please use a strong unique password.</p>
        ),
      },
      {
        title: "Your Rights",
        body: (
          <p>You can request access to, correction of, or deletion of your data at any time by emailing us. Closing your account removes your data within 30 days, except where we must retain it for legal reasons.</p>
        ),
      },
      {
        title: "Contact",
        body: (
          <p>Questions about this policy? Email us at <a href="mailto:support@getpharmiq.com" className="text-primary font-semibold underline">support@getpharmiq.com</a>.</p>
        ),
      },
    ]}
  />
);
export default Privacy;
