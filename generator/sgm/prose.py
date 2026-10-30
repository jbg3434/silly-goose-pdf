"""Shared explanatory prose. Placeholders: {product} {family} {state} {insured} {risk}
{risks} {producer_focus}. No answer-bearing values appear here; those come from facts."""

FRONT = [
    "This guide describes how Silly Goose Mutual writes {product} business in {state}. It is organized so that a producer, underwriter, or service representative can find a rule quickly, confirm the value that applies in {state}, and trace that value back to the numbered provision and the state addendum. Where {state} differs from the countrywide {family} baseline, the difference is stated in the body of the guide and repeated in Appendix B.",
    "Values printed in this guide govern new business and renewals effective on or after the edition date on the cover. A submission is evaluated under the edition in force on its effective date, not the date it was received. When an earlier edition is consulted for a historical policy, the revision history in Appendix C identifies which provisions changed and why.",
    "Each section opens with a short orientation, followed by numbered provisions, a summary table where one is useful, and notes for producers. Footnotes qualify the value they are attached to and must be read with it. Cross-references in the form \"see Section 4.2\" point to the provision that controls a related value; the referenced value always reflects {state}.",
    "The guide is written for licensed producers and Silly Goose Mutual staff. It does not replace the policy forms, which control in the event of any conflict. Questions about a provision that this guide does not answer should be referred to the {state} underwriting desk rather than resolved by analogy to another state's guide.",
]

SECTION_PROSE = {
    "overview": [
        "{product} is the Silly Goose Mutual {family} program for {risks} located in {state}. The program combines a countrywide coverage chassis with state-specific terms that reflect {state} law, simulated filing conditions, and local loss experience. Producers should read the eligibility section before quoting, because several referral triggers apply before any price is shown.",
        "The program is designed for straightforward risks that can be written with standard forms and a limited set of optional endorsements. Risks that need manuscript wording, unusual limits, or a combination of exposures not described here fall outside the program and should be referred before any commitment is made to the {insured}.",
        "Throughout this guide, the term {insured} refers to the person or entity shown in the declarations, and {risk} refers to the property, operation, or exposure scheduled on the policy. Defined terms appear in the glossary in Appendix A and carry the same meaning wherever they are used.",
    ],
    "eligibility": [
        "Eligibility rules determine whether a submission can be quoted at all. A risk that fails any rule in this section is ineligible regardless of price, prior carrier, or producer volume. Producers should collect {producer_focus} before entering a quote, because the rating system applies these rules automatically and will decline an incomplete submission.",
        "Referral is different from ineligibility. A referred risk may still be written after underwriter review, and the underwriter may impose conditions, require an inspection, or adjust terms within the limits of this guide. Underwriters may not override a rule that this guide states as an absolute requirement.",
        "Information used to establish eligibility must be current as of the proposed effective date. Where a rule depends on a count, age, or measurement, the producer should record the source of the figure in the submission notes so that the decision can be reconstructed on audit.",
        "Prior cancellation or nonrenewal by another carrier does not by itself make a risk ineligible, but the reason must be disclosed. Material misrepresentation discovered after binding is handled under the cancellation provisions in Section 10.",
    ],
    "coverages": [
        "This section sets out the coverage parts available under {product} and the limits that may be offered in {state}. Limits are stated per the unit shown with each provision; aggregate limits, where they exist, cap the total payable during the policy period regardless of the number of claims.",
        "Higher limits than those shown may be available by referral, subject to reinsurance and underwriting approval. Lower limits than the stated minimum may not be offered. When a {state} minimum differs from the family baseline, the {state} figure controls and is listed again in the state addendum.",
        "Coverage descriptions in this guide summarize the policy forms and are not a substitute for them. When explaining coverage to an {insured}, producers should refer to the form numbers listed in Section 8 and avoid characterizing coverage more broadly than the forms provide.",
        "Sublimits apply within, not in addition to, the limit of the coverage part they belong to unless this guide expressly states otherwise. A sublimit that is printed in a summary table and qualified by a footnote must be read together with that footnote.",
    ],
    "deductibles": [
        "Deductibles and retentions are applied per occurrence or per claim as stated with each provision. Where more than one deductible could apply to the same loss, only the largest applicable deductible is taken unless a provision states that deductibles are cumulative.",
        "Percentage deductibles are calculated on the limit or value stated in the provision, not on the amount of the loss. Producers should illustrate a percentage deductible in dollars for the {insured} at quotation so that the out-of-pocket exposure is understood before binding.",
        "Optional deductibles may be selected at new business or renewal. A mid-term deductible change requires underwriter approval and takes effect only for losses occurring after the change is processed.",
    ],
    "endorsements": [
        "Optional endorsements broaden, narrow, or add coverage for an additional premium. Each endorsement listed here has its own eligibility rules, and an endorsement that is not available in {state} must not be offered even if it appears in another state's guide.",
        "Endorsement limits apply in addition to the base policy limits unless the endorsement says otherwise. Where an endorsement carries conditions, those conditions are printed with the provision and are repeated in the endorsement form.",
        "Producers should confirm that the {insured} understands the difference between an endorsement that adds a new coverage and one that merely increases a limit that already exists in the base form. Misunderstanding of this distinction is a common source of service complaints.",
    ],
    "exclusions": [
        "Exclusions remove specific losses or exposures from coverage. The exclusions summarized here are those most often relevant to underwriting decisions; the policy forms contain the complete list, and an exclusion not described in this guide still applies.",
        "Some exclusions contain exceptions or limited give-backs. A give-back restores coverage only to the extent and up to the amount stated, and it does not create coverage for a loss excluded for another reason.",
        "Where an exclusion depends on a threshold, the threshold is measured as of the date of loss unless the provision states another measurement date. Producers should not suggest ways to avoid an exclusion by restructuring a risk after a loss.",
    ],
    "waiting": [
        "Waiting periods and effective-date rules control when coverage begins, when it may be bound, and how long automatic coverage lasts for newly acquired exposures. These rules protect the program from adverse selection and must be applied consistently.",
        "Binding restrictions apply to new business, increases in limits, and the addition of new {risks}. Renewals and decreases in coverage are not restricted unless a provision says so. The restriction is lifted only when the triggering advisory has been cancelled for the county concerned.",
        "Automatic coverage periods begin on the date the exposure is acquired, not the date it is reported. Producers should encourage the {insured} to report new exposures promptly, because coverage ends automatically when the stated period expires.",
    ],
    "forms": [
        "The forms listed in this section are the only forms approved for use with {product} in {state} under this edition. Each form is identified by number and title; the edition date of the form appears on the form itself and in the policy declarations.",
        "A {state} amendatory endorsement is attached to every policy. It conforms the base form to {state} requirements and controls over any conflicting provision of the base form or of this guide.",
        "Producers must deliver the policy forms to the {insured} with the declarations. Electronic delivery is permitted where the {insured} has consented, and the consent record must be retained with the submission.",
    ],
    "rating": [
        "Rating rules determine the premium for an eligible risk. Credits and surcharges are applied in the order stated in the rating manual, and the combined effect of credits may be capped as noted. A credit that is not supported by documentation in the file is removed at audit.",
        "Credits described here are available only when the qualifying condition exists at the effective date and is maintained throughout the policy period. Loss of a qualifying condition mid-term is handled at renewal unless the condition is a safety requirement, in which case the underwriter may act immediately.",
        "Rates and rating factors are filed separately from this guide. The percentages shown here describe the program design; the premium shown on a quotation is the authoritative figure for an individual {insured}.",
    ],
    "billing": [
        "Billing plans, cancellation, and nonrenewal procedures follow {state} requirements. Notice periods are measured from the date of mailing to the date the action takes effect, and proof of mailing must be retained.",
        "An {insured} may cancel at any time by written request. Return premium on an insured-requested cancellation is calculated on the basis described in the policy, and any installment fees already charged are not refunded.",
        "Cancellation for underwriting reasons is limited to the grounds permitted in {state}. Producers should never indicate to an {insured} that a policy will be cancelled until a formal notice has been issued by Silly Goose Mutual.",
    ],
    "claims": [
        "Claims are reported to Silly Goose Mutual through the claim line, the producer portal, or the mobile app. Producers may assist the {insured} with reporting but may not make coverage determinations or commit Silly Goose Mutual to payment.",
        "After a claim is reported, an adjuster contacts the {insured}, explains the next steps, and identifies any documents needed. Where a proof of loss is requested, the request states the deadline and the information required.",
        "Service standards in this section describe Silly Goose Mutual's internal commitments. They do not extend any deadline imposed on the {insured} by the policy or by {state} law, and they do not create coverage where none exists.",
    ],
}

SCENARIOS = [
    "Illustrative scenario (invented for training; not a real claim or coverage determination): A {insured} in {state} asks whether {topic_lc} would affect a pending submission. Under Section {number}, the applicable figure in {state} is {value}. The producer records the figure in the submission notes and cites Section {number} in the file.",
    "Illustrative scenario (invented for training): An underwriter reviewing a {state} {family} file confirms {topic_lc}. The value for this edition is {value}; the underwriter notes that the figure in another state's guide may differ and does not rely on it.",
    "Illustrative scenario (invented for training): During a renewal review in {state}, a service representative is asked about {topic_lc}. The representative quotes {value} from Section {number} and points the {insured} to the policy form for the complete wording.",
]

# Per-provision detail. Variant is chosen by a stable hash of the fact id, so the same
# provision reads identically across states while values differ — the hard retrieval case.
GUIDANCE = {
    "eligibility": [
        "Underwriting guidance: apply the {topic_lc} rule at quotation and again at binding if the submission has changed. A risk that does not meet the {value} standard in {state} is handled as described in Section {sec}.1; do not quote alternative terms to work around it.",
        "Underwriting guidance: the {value} figure is a {state} requirement for {risks}. Underwriters record any exception request in the file with the reason and the approving authority, and exceptions are reviewed in the quarterly {state} audit.",
    ],
    "coverages": [
        "Underwriting guidance: quote this coverage at the {value} figure where the form permits. When the {insured} asks for a different figure, explain that only the {state} figure printed here is available under this edition.",
        "Underwriting guidance: requests beyond the printed figure require referral. The {value} figure is the term stated for {state} and is the figure shown on the quotation unless an underwriter approves otherwise in writing.",
    ],
    "deductibles": [
        "Underwriting guidance: illustrate the {value} amount in dollars for the {insured} before binding, and confirm the selection on the signed application. Deductible options not listed in this section may not be offered in {state}.",
        "Underwriting guidance: where a loss could trigger more than one deductible, compare this {value} amount with the other deductibles in Section {sec} and apply only the largest unless the provision states otherwise.",
    ],
    "endorsements": [
        "Underwriting guidance: offer this option only after the base coverage is quoted. The {value} figure applies to {state} policies; confirm the endorsement form appears on the declarations before issuing evidence of coverage.",
        "Underwriting guidance: the endorsement is optional and priced separately. When the {insured} declines it, note the declination in the file; when the {insured} accepts it, confirm the {value} figure on the quotation.",
    ],
    "exclusions": [
        "Underwriting guidance: explain this provision plainly to the {insured} at quotation. The {value} threshold is measured at the date of loss, and producers should not describe the exclusion as negotiable.",
        "Underwriting guidance: when an applicant's operations are close to the {value} threshold, refer the submission so that an underwriter can confirm whether the exclusion is likely to apply.",
    ],
    "waiting": [
        "Underwriting guidance: the {value} period is computed in calendar terms from the triggering event. Underwriters record the triggering date in the file so that the period can be verified later.",
        "Underwriting guidance: requests that fall within the {value} window are pended rather than declined, and the producer is told when the request can be reconsidered.",
    ],
    "rating": [
        "Underwriting guidance: apply the {value} adjustment only when qualifying documentation is in the file at the effective date. Credits not supported by documentation are removed at audit with return or additional premium as appropriate.",
        "Underwriting guidance: the {value} figure describes program design in {state}; the rating system applies it automatically once the qualifying answer is recorded on the application.",
    ],
    "billing": [
        "Service guidance: billing staff calendar the {value} figure from the date of mailing. Proof of mailing is retained for the life of the policy plus the {state} record-retention period.",
        "Service guidance: when the {insured} asks how this provision works, staff quote the {value} figure and direct the {insured} to the notice they received.",
    ],
    "claims": [
        "Service guidance: adjusters calendar the {value} figure at first notice. A missed service target is escalated to the {state} claim manager the same day.",
        "Service guidance: the {value} figure is explained to the {insured} during the first contact, together with the documents the adjuster expects to need.",
    ],
}

DOCUMENTATION = [
    "Documentation: retain the source of every figure used to apply this provision, including {producer_focus}, with the submission.",
    "Documentation: the file should show who confirmed the figure, when it was confirmed, and which edition of this guide was applied.",
    "Documentation: when this provision affects the quotation, add a note referencing Section {number} so that a later reviewer can trace the decision.",
]

EXAMPLES = [
    "Example (synthetic): A producer quoting a {state} {family} risk checks the {topic_lc} and finds the guide value of {value}. Because the submission meets the figure, the producer proceeds without referral.",
    "Example (synthetic): An {insured} asks whether another state's figure for the {topic_lc} applies. The producer explains that only the {state} figure of {value} in Section {number} applies to this policy.",
    "Example (synthetic): During an audit, a reviewer compares the policy file with Section {number} and confirms that the {topic_lc} was applied at {value}.",
    "Example (synthetic): A new service representative is asked about the {topic_lc}. The representative reads Section {number}, quotes {value}, and notes any condition printed with the provision.",
]
