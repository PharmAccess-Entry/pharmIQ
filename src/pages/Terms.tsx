import LegalPage from "@/components/LegalPage";

const Terms = () => (
  <LegalPage
    kind="terms"
    title="Terms of Service"
    intro="Welcome to PharmIQ Nigeria. By creating an account or using our service, you agree to these terms. Please read them carefully — they explain what you can expect from us, and what we expect from you."
    sections={[
      {
        title: "Use of Service",
        body: (
          <>
            <p>You agree to use PharmIQ only for lawful pharmacy operations and to comply with all applicable Nigerian laws.</p>
            <p>You may not abuse, reverse-engineer, or disrupt the service for other users. We may suspend accounts that violate these terms.</p>
          </>
        ),
      },
      {
        title: "Subscription & Payments",
        body: (
          <>
            <p>Plans are billed monthly or yearly. Yearly plans receive 2 months free.</p>
            <p>You may cancel at any time; access continues until the end of the current billing period. We do not offer pro-rata refunds for partial months.</p>
          </>
        ),
      },
      {
        title: "Account Responsibility",
        body: (
          <>
            <p>You are responsible for keeping your login credentials secure and for all activity under your account.</p>
            <p>If you suspect unauthorised access, change your password immediately and contact support.</p>
          </>
        ),
      },
      {
        title: "Customer Data",
        body: (
          <>
            <p>Order data, customer messages and uploaded payment screenshots belong to your pharmacy. We process them on your behalf to operate the service.</p>
            <p>You are responsible for displaying any required notices to your in-restaurant customers.</p>
          </>
        ),
      },
      {
        title: "Limitation of Liability",
        body: (
          <p>PharmIQ is provided "as is" without warranties of any kind. To the fullest extent permitted by law, we are not liable for indirect, incidental, or consequential damages arising from use of the service.</p>
        ),
      },
      {
        title: "Changes to These Terms",
        body: (
          <p>We may update these terms from time to time. Material changes will be communicated via email or in-app notice at least 14 days before they take effect.</p>
        ),
      },
    ]}
  />
);
export default Terms;
