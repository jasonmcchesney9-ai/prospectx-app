"use client";

import MarketingLayout from "@/components/MarketingLayout";

const SECTIONS = [
  {
    num: 1,
    title: "Acceptance of Terms",
    body: 'By accessing or using ProspectX Intelligence ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.',
  },
  {
    num: 2,
    title: "Use of the Service",
    body: "You may use the Service only for lawful purposes and in accordance with these Terms. You agree not to use the Service in any way that violates applicable laws or regulations.",
  },
  {
    num: 3,
    title: "Customer Data",
    body: 'As between you and us, you retain all rights, title and interest in and to any data, video, statistics, reports or other content that you or your Authorized Users upload or otherwise submit to the Service ("Customer Data"). You are solely responsible for the accuracy, quality, legality and appropriateness of all Customer Data.',
  },
  {
    num: 4,
    title: "Third-Party Sources",
    body: "Customer Data may include content exported or obtained from third-party products or services. You are solely responsible for ensuring you have all necessary rights, licenses and permissions from any such third parties to upload, store and use that content in connection with the Service.",
  },
  {
    num: 5,
    title: "Our Use of Customer Data",
    body: "You grant us a non-exclusive, worldwide, royalty-free license to host, store, reproduce, process and display Customer Data solely as necessary to provide, maintain, secure and improve the Service, to develop new features and products, and to prevent or address service, security or technical issues. We will not disclose Customer Data to other customers or third parties except as described in our Privacy Policy or as required by law.",
  },
  {
    num: 6,
    title: "Derived Analytics",
    body: 'We may generate de-identified or aggregated data derived from Customer Data and usage of the Service ("Aggregated Data"). Aggregated Data will not identify you, your Authorized Users, or individual players or teams in a way that is reasonably capable of being re-associated with them. We may use Aggregated Data for our legitimate business purposes, including to improve and market the Service.',
  },
  {
    num: 7,
    title: "Data Segregation",
    body: "We implement logical data segregation so that Customer Data for each organization is siloed from other organizations' data within the Service. We will not intentionally make your Customer Data available to other customers except as you direct.",
  },
  {
    num: 8,
    title: "Intellectual Property",
    body: "The Service and its original content, features and functionality are and will remain the exclusive property of ProspectX Intelligence and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of ProspectX Intelligence.",
  },
  {
    num: 9,
    title: "Termination",
    body: "We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason, including if you breach these Terms.",
  },
  {
    num: 10,
    title: "Limitation of Liability",
    body: "In no event shall ProspectX Intelligence, its directors, employees, partners, agents, suppliers or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of (or inability to access or use) the Service.",
  },
  {
    num: 11,
    title: "Changes to Terms",
    body: "We reserve the right to modify or replace these Terms at any time. We will provide notice of any significant changes by updating the date at the top of this page. Your continued use of the Service after any changes constitutes acceptance of the new Terms.",
  },
  {
    num: 12,
    title: "Contact",
    body: "If you have any questions about these Terms, contact us at legal@prospectxintelligence.com",
  },
];

export default function TermsPage() {
  return (
    <MarketingLayout>
      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-[760px] mx-auto">
          {/* Header */}
          <h1 className="text-3xl sm:text-4xl font-oswald font-bold text-white mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-white/40 mb-12">
            Last updated: March 6, 2026
          </p>

          {/* Sections */}
          <div className="space-y-8">
            {SECTIONS.map((section) => (
              <div key={section.num}>
                <h2 className="text-base font-oswald font-semibold text-white mb-2">
                  <span className="text-teal">Section {section.num}</span>
                  {" \u2014 "}
                  {section.title}
                </h2>
                <p className="text-sm text-white/50 leading-relaxed">
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
