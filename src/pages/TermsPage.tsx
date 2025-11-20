import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function TermsPage() {
    const { hash } = useLocation();

    useEffect(() => {
        if (hash) {
            const element = document.getElementById(hash.replace("#", ""));
            if (element) {
                element.scrollIntoView({ behavior: "smooth" });
            }
        } else {
            window.scrollTo(0, 0);
        }
    }, [hash]);

    return (
        <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto prose prose-neutral">
                <h1 className="text-3xl font-bold text-neutral-900 mb-8">Terms & Conditions + Privacy Policy</h1>

                <div className="bg-neutral-50 p-6 rounded-xl border border-neutral-200 mb-12">
                    <h2 className="text-xl font-semibold mb-4 mt-0">Table of Contents</h2>
                    <ul className="list-none pl-0 space-y-2">
                        <li><a href="#terms" className="text-primary-600 hover:underline">Terms and Conditions</a></li>
                        <li><a href="#privacy" className="text-primary-600 hover:underline">Privacy Policy</a></li>
                    </ul>
                </div>

                <section id="terms" className="mb-16 scroll-mt-24">
                    <h2 className="text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2 mb-6">TERMS AND CONDITIONS</h2>

                    <p className="text-sm text-neutral-500 mb-6">
                        Last updated: [Date]<br />
                        Operator: [Your name / company], ABN [xxxxxx], trading as FlyerBoard (“we”, “our”, “us”, “Platform”)<br />
                        Website: https://[your-domain].com.au (“Website”)<br />
                        Users: Anyone who registers, posts, browses or uses the Website (“User”, “you”, “your”).
                    </p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">1. Accepting these Terms</h3>
                    <p>By accessing or using the Website you agree to these Terms. If you do not agree, you must stop using the Website. You acknowledge you are over 18 (or have guardian consent).</p>
                    <p>We may update these Terms at any time; we will provide notice (via the Website or email). Continued use after changes means you accept them.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">2. Role of the Platform</h3>
                    <p>The Platform acts as an online marketplace facilitating connections between Users (e.g., persons who post ads and persons who respond to ads).</p>
                    <p>We are not the seller, buyer, or service provider in any transaction between Users. We do not take custody of goods, provide services, guarantee listings, or set terms of sale.</p>
                    <p>Any agreement, transaction or interaction is exclusively between Users, and you deal at your own risk.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">3. User Accounts & Registration</h3>
                    <p>You may register an account and select a password. You are responsible for all activity using your account. You must provide accurate details and keep them updated.</p>
                    <p>We may suspend or terminate accounts at our discretion (for suspected fraud, violation of these Terms, or inactivity) without liability.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">4. User Conduct & Listings</h3>
                    <p><strong>4.1</strong> You represent and warrant that any Listing you post is true, accurate, not misleading and complies with all applicable Australian laws (including the Australian Consumer Law).</p>
                    <p><strong>4.2</strong> You must not post Listings or content that:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Are unlawful, infringe third-party rights, or facilitate illegal conduct.</li>
                        <li>Contain prohibited items (for example weapons, illicit drugs, stolen goods, etc).</li>
                        <li>Contain viruses, malicious code, or attempt unauthorised access.</li>
                    </ul>
                    <p><strong>4.3</strong> We may remove or suspend any Listing or content at our sole discretion.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">5. Intellectual Property</h3>
                    <p>All content on the Website (text, logos, images, software) is owned or licensed by us unless otherwise stated. You may not reproduce, modify or exploit it without written permission.</p>
                    <p>By uploading your Listing content (images/text) you grant us a non-exclusive, worldwide, royalty-free licence to use, display, reproduce and distribute that content in connection with the Platform.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">6. Payments & Fees</h3>
                    <p>If you choose paid features (e.g., “boost” or “pin to top”), you agree to the applicable pricing and payment terms. All fees are non-refundable except as required by law.</p>
                    <p>We may change pricing or introduce new features; changes will be notified.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">7. Disclaimers & Limitation of Liability</h3>
                    <p><strong>7.1</strong> The Platform is provided “as is” and we make no warranties (express or implied) including fitness for purpose, accuracy of Listings, or availability.</p>
                    <p><strong>7.2</strong> To the maximum extent permitted by law, our liability is excluded for any loss or damage arising from your use of the Website or transactions with other Users.</p>
                    <p><strong>7.3</strong> Nothing in these Terms excludes or limits liability which cannot be excluded under Australian law (e.g., consumer guarantees under ACL).</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">8. Indemnity</h3>
                    <p>You agree to indemnify, defend and hold harmless the Platform and its officers, directors, employees from any claim, loss or demand (including legal costs) arising out of your use of the Website or breach of these Terms.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">9. Privacy & Data Security</h3>
                    <p>Your use of personal information is governed by our Privacy Policy (see section below). You agree that we may collect, use and disclose your data as described in that policy.</p>
                    <p>We take reasonable steps to protect your data; however, we do not guarantee security and you use the Website at your own risk.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">10. Governing Law & Jurisdiction</h3>
                    <p>These Terms are governed by the laws of [State/Territory, e.g., Victoria] and you submit to the non-exclusive jurisdiction of its courts.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">11. General</h3>
                    <p>If any part of these Terms is invalid or unenforceable, it will be severed and the rest remain in effect. These Terms constitute the entire agreement between you and us in respect of your use of the Website.</p>
                </section>

                <section id="privacy" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2 mb-6">PRIVACY POLICY</h2>

                    <p className="text-sm text-neutral-500 mb-6">
                        Last updated: [Date]<br />
                        Controller: [Your name / company], ABN [xxxxxx], trading as FlyerBoard<br />
                        Website: https://[your-domain].com.au<br />
                        We are committed to protecting your personal information and complying with the Privacy Act 1988 and the Australian Privacy Principles (APPs).
                    </p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">1. What information we collect</h3>
                    <p>We collect:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Account data (name, email, phone number)</li>
                        <li>Listing data (images, description, price, location)</li>
                        <li>Usage data (IP address, browser type, device)</li>
                        <li>Payment data (where applicable, processed securely by third-party)</li>
                    </ul>
                    <p>We only collect what is required for our functions and operations.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">2. Use of personal information</h3>
                    <p>We use your information to:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Provide and improve the Platform</li>
                        <li>Facilitate listings, transactions and communications between Users</li>
                        <li>Authenticate Users and manage accounts</li>
                        <li>Comply with legal obligations</li>
                        <li>Send service communications (You may opt-out of marketing emails)</li>
                    </ul>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">3. Disclosure of personal information</h3>
                    <p>We may disclose your information to:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Other Users (as necessary for the Listing process)</li>
                        <li>Our service providers (hosting, payment, analytics) under confidentiality agreements</li>
                        <li>Government or regulatory bodies if required by law</li>
                    </ul>
                    <p>We do not sell your personal information for direct marketing without consent.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">4. Data Transfer & Storage</h3>
                    <p>Your data may be stored and processed in Australia and/or overseas where we or our service providers operate. We will take reasonable steps to ensure overseas recipients handle your data in accordance with APPs.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">5. Data Security & Retention</h3>
                    <p>We take reasonable steps to protect your personal information from misuse, interference or loss. However, no system is perfect; we cannot guarantee absolute security.</p>
                    <p>We retain your data for as long as needed to provide the Platform, comply with legal obligations, or resolve disputes.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">6. Access, Correction & Deletion</h3>
                    <p>You may request access to your personal information, correct it or ask for its deletion by contacting us at [email@example.com].</p>
                    <p>We will respond within a reasonable time.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">7. Notifiable Data Breaches</h3>
                    <p>We comply with the Notifiable Data Breaches scheme: if a breach is likely to cause serious harm we will notify affected individuals and the Office of the Australian Information Commissioner (OAIC) as required.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">8. Cookies & Tracking</h3>
                    <p>We use cookies and similar technologies to run and optimise the Platform. You can manage your browser settings to limit cookies, but this may affect functionality.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">9. Children’s Privacy</h3>
                    <p>We do not knowingly collect personal information from children under 16 without parental/guardian consent. If you believe we have collected such data, contact us and we will remove it.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">10. Changes to this Policy</h3>
                    <p>We may change this Privacy Policy from time to time and will update the “Last updated” date. Continued use after changes means you consent to them.</p>

                    <h3 className="text-lg font-semibold text-neutral-900 mt-8 mb-4">11. Contact Us</h3>
                    <p>If you have questions about this Policy or your personal information, contact:</p>
                    <p>
                        [Your name / company]<br />
                        Email: [email@example.com]<br />
                        Address: [Postal address]
                    </p>
                </section>
            </div>
        </div>
    );
}
