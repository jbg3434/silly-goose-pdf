"""Canonical fact model, override generation, resolution, and renderer-neutral document blocks."""
import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path

from . import facts_data as D
from . import prose as P
from .util import fmt_value, rng

GENERATOR_VERSION = "sgm-gen/2.0.0"
SEED = "silly-goose-mutual-corpus-v1"
ROOT = Path(__file__).resolve().parents[2]
SECTION_ORDER = [s for s, _ in D.SECTIONS]
SECTION_TITLES = dict(D.SECTIONS)
STATE_REASONS = ["STATE_STATUTE", "DOI_FILING_CONDITION", "MARKET_CONDITION", "CAT_EXPOSURE", "LOSS_EXPERIENCE"]
ABSENT = object()
REFERRAL_ACTIONS = {
    "eligibility": "Refer to underwriting; do not bind", "coverages": "Refer for limit approval",
    "deductibles": "Quote only listed options", "endorsements": "Quote only listed endorsement terms",
    "exclusions": "Refer before binding", "waiting": "Pend until the restriction ends",
    "rating": "Remove the credit or refer", "billing": "Follow the notice procedure",
    "claims": "Escalate to the claim manager", "overview": "Refer to underwriting", "forms": "Use approved forms only",
}


def load_json(name):
    return json.loads((ROOT / "data" / name).read_text())


@dataclass
class Fact:
    fact_id: str
    product_id: str
    section_id: str
    key: str
    topic: str
    template: str
    value: str
    unit: str | None
    alts: list
    in_table: bool
    conditions: list = field(default_factory=list)
    footnote: str | None = None
    related: list = field(default_factory=list)
    introduced: int = 1

    @property
    def local(self):
        return f"{self.section_id}.{self.key}"


# Challenge-set overrides: (product, state, edition, local fact, value | ABSENT | None=keep, conditions, reason)
FORCED = [
    ("small-business-cyber", "NY", 1, "coverages.ransomware", "500000", None, "MARKET_CONDITION"),
    ("small-business-cyber", "NJ", 1, "coverages.ransomware", "100000", None, "LOSS_EXPERIENCE"),
    ("small-business-cyber", "NJ", 1, "waiting.bi_wait", "12", None, "DOI_FILING_CONDITION"),
    ("small-business-cyber", "NY", 2, "waiting.bi_wait", "6", None, "PRODUCT_REFRESH"),
    ("small-business-cyber", "PA", 2, "waiting.bi_wait", "10", None, "PRODUCT_REFRESH"),
    ("renters", "FL", 1, "endorsements.pet_damage", None,
     ["Not available for exotic animals, except non-venomous reptiles kept in a locked enclosure."], "STATE_STATUTE"),
    ("personal-umbrella", "TX", 1, "endorsements.um_excess", ABSENT, None, "STATE_STATUTE"),
    ("personal-umbrella", "WA", 1, "eligibility.watercraft_max_length", "40", None, "DOI_FILING_CONDITION"),
    ("personal-umbrella", "WA", 1, "eligibility.watercraft_max_value", "2000000", None, "DOI_FILING_CONDITION"),
]
LOCKED = {(p, s, f) for p, s, _, f, *_ in FORCED} | {("personal-umbrella", "WA", "eligibility.watercraft_use")}


class Corpus:
    def __init__(self):
        self.states = load_json("states.json")
        self.products = load_json("products.json")
        self.editions = sorted(load_json("editions.json"), key=lambda e: e["edition"])
        self.regulations = load_json("synthetic-regulations.json")
        self.facts = {p["id"]: self._facts(p) for p in self.products}
        self.overrides = {}
        self._generate_overrides()

    def _facts(self, product):
        pid, code = product["id"], product["code"]
        rows = D.FAMILY_FACTS[pid] + D.COMMON_FACTS
        out = []
        for sec, key, topic, tmpl, val, unit, alts, in_table in rows:
            full = f"{pid}.{sec}.{key}"
            out.append(Fact(f"{code}.{sec}.{key}", pid, sec, key, topic, tmpl, val, unit, list(alts), in_table,
                            list(D.CONDITIONS.get(full, [])), D.FOOTNOTES.get(full), list(D.RELATED.get(full, [])),
                            D.INTRODUCED_IN.get(full, 1)))
        out.sort(key=lambda f: SECTION_ORDER.index(f.section_id))
        return out

    def fact(self, product_id, local):
        for f in self.facts[product_id]:
            if f.local == local:
                return f
        raise KeyError(f"{product_id}:{local}")

    def _put(self, pid, state, ed, f, value, conditions, reason):
        self.overrides[(pid, state, ed, f.fact_id)] = dict(value=value, conditions=conditions, reason=reason)

    def _generate_overrides(self):
        for pid, state, ed, local, value, conds, reason in FORCED:
            f = self.fact(pid, local)
            v = None if value is ABSENT else (f.value if value is None else value)
            self._put(pid, state, ed, f, v, conds, reason)
        for p in self.products:
            pid = p["id"]
            for s in self.states:
                st = s["code"]
                r = rng(SEED, "state", pid, st)
                pool = [f for f in self.facts[pid] if f.introduced == 1 and (pid, st, f.local) not in LOCKED]
                forced = sum(1 for k in self.overrides if k[:3] == (pid, st, 1))
                n = r.randint(8, 15) - forced
                picks = [r.choice([f for f in pool if f.in_table]), r.choice([f for f in pool if not f.in_table])]
                rest = [f for f in pool if f not in picks]
                picks += r.sample(rest, max(0, n - 2))
                for f in picks:
                    self._put(pid, st, 1, f, r.choice([a for a in f.alts if a != f.value]), None, r.choice(STATE_REASONS))
                r2 = rng(SEED, "edition2", pid, st)
                introduced = [f for f in self.facts[pid] if f.introduced == 2]
                forced2 = sum(1 for k in self.overrides if k[:3] == (pid, st, 2))
                n2 = r2.randint(2, 5) - forced2 - len(introduced)
                pool2 = [f for f in pool if self.resolve_fact(f, st, 1)[0] is not None]
                for f in r2.sample(pool2, max(0, n2)):
                    cur = self.resolve_fact(f, st, 1)[0]
                    self._put(pid, st, 2, f, r2.choice([a for a in f.alts + [f.value] if a != cur]), None, "PRODUCT_REFRESH")

    def resolve_fact(self, f, state, edition):
        """Returns (value | None if absent, conditions, override or None)."""
        if edition < f.introduced:
            return None, [], None
        for ed in range(edition, 0, -1):
            o = self.overrides.get((f.product_id, state, ed, f.fact_id))
            if o:
                return o["value"], (o["conditions"] if o["conditions"] is not None else f.conditions), dict(o, edition=ed)
        return f.value, f.conditions, None

    def regulation_ref(self, state, section_id):
        category = {"billing": "notice", "claims": "claims", "eligibility": "eligibility",
                    "waiting": "catastrophe", "deductibles": "catastrophe"}.get(section_id, "coverage")
        return next(r["rule_id"] for r in self.regulations["states"][state] if r["category"] == category)

    def doc_id(self, product, state, edition):
        return f"SGM-{product['code']}-{state}-E{edition}"


class Doc:
    """Renderer-neutral content for one product/state/edition guide."""

    def __init__(self, corpus: Corpus, product, state, edition_def):
        self.c, self.p, self.state = corpus, product, state
        self.ed = edition_def
        self.edition = edition_def["edition"]
        self.state_name = next(s["name"] for s in corpus.states if s["code"] == state)
        self.document_id = corpus.doc_id(product, state, self.edition)
        self.facts = corpus.facts[product["id"]]
        self.resolved = {}
        for f in self.facts:
            v, conds, o = corpus.resolve_fact(f, state, self.edition)
            if v is not None:
                self.resolved[f.local] = dict(fact=f, value=v, display=fmt_value(v, f.unit), conditions=conds, override=o,
                                              text=f.template.format(value=fmt_value(v, f.unit)))
        self.numbers = {}
        self.blocks = []
        self.errors = []
        self._build()

    # ---- helpers
    def ctx(self, **extra):
        n = D.FAMILY_NOUNS[self.p["id"]]
        return dict(product=self.p["display_name"], family=self.p["family"], state=self.state_name, **n, **extra)

    def _sub(self, text):
        out = text
        while "{fact:" in out or "{section:" in out:
            start = out.index("{fact:") if "{fact:" in out else out.index("{section:")
            end = out.index("}", start)
            kind, ref = out[start + 1:end].split(":", 1)
            if ref not in self.resolved:
                self.errors.append(f"{self.document_id}: dangling reference {ref}")
                rep = "[missing]"
            else:
                rep = self.resolved[ref]["display"] if kind == "fact" else self.numbers[ref]
            out = out[:start] + rep + out[end + 1:]
        return out

    def changes(self):
        if self.edition == 1:
            return []
        rows = []
        for f in self.facts:
            prev = self.c.resolve_fact(f, self.state, self.edition - 1)[0]
            cur = self.c.resolve_fact(f, self.state, self.edition)[0]
            if prev != cur:
                rows.append(dict(fact_id=f.fact_id, local=f.local, topic=f.topic,
                                 before=fmt_value(prev, f.unit) if prev is not None else "Not included",
                                 after=fmt_value(cur, f.unit) if cur is not None else "Not included"))
        return rows

    def state_differences(self):
        rows = []
        for f in self.facts:
            if self.edition < f.introduced:
                continue
            v, conds, o = self.c.resolve_fact(f, self.state, self.edition)
            if o is None:
                continue
            base = fmt_value(f.value, f.unit)
            if v is None:
                now = f"Not offered in {self.state}"
            elif v == f.value and conds != f.conditions:
                now = f"{base}; " + " ".join(conds)
            else:
                now = fmt_value(v, f.unit)
            if v == f.value and conds == f.conditions:
                continue
            rows.append(dict(fact_id=f.fact_id, local=f.local, topic=f.topic, base=base, value=now, reason=o["reason"],
                             regulation=self.c.regulation_ref(self.state, f.section_id),
                             section=self.numbers.get(f.local, SECTION_TITLES[f.section_id])))
        return rows

    # ---- content
    def _build(self):
        B = self.blocks
        sec_num = {s: i + 1 for i, s in enumerate(SECTION_ORDER)}
        for s in SECTION_ORDER:
            j = 0
            for f in self.facts:
                if f.section_id == s and f.local in self.resolved:
                    j += 1
                    self.numbers[f.local] = f"{sec_num[s]}.{j + 1}"
        B.append(dict(kind="h1", number="", title="How to Use This Guide", anchor="intro"))
        for t in P.FRONT:
            B.append(dict(kind="p", text=t.format(**self.ctx())))
        scen = rng(SEED, "scenario", self.document_id)
        changes = self.changes()
        for s in SECTION_ORDER:
            n = sec_num[s]
            B.append(dict(kind="h1", number=str(n), title=SECTION_TITLES[s], anchor=s))
            B.append(dict(kind="h2", number=f"{n}.1", title="Orientation"))
            for t in P.SECTION_PROSE[s]:
                B.append(dict(kind="p", text=t.format(**self.ctx())))
            present = [f for f in self.facts if f.section_id == s and f.local in self.resolved]
            for f in present:
                r = self.resolved[f.local]
                xrefs = [f"see Section {self.numbers[x]} ({self.c.fact(self.p['id'], x).topic.lower()})"
                         for x in f.related if x in self.resolved]
                notes = [self._sub(f.footnote)] if f.footnote else []
                B.append(dict(kind="fact", number=self.numbers[f.local], topic=f.topic, text=r["text"], fact_id=f.fact_id,
                              local=f.local, conditions=r["conditions"], xrefs=xrefs, notes=notes,
                              details=self._details(f, r, n, changes)))
            if present:
                B.append(dict(kind="p", facts=[f.fact_id for f in present], text=f"Section {n} summary for {self.state_name}: " + "; ".join(
                    f"{f.topic.lower()} — {self.resolved[f.local]['display']}" for f in present) + "."))
            if s == "overview":
                B.append(self._glance())
            table_facts = [f for f in present if f.in_table]
            if table_facts:
                rows, notes = [], []
                for f in table_facts:
                    r = self.resolved[f.local]
                    mark = ""
                    if f.footnote:
                        notes.append(self._sub(f.footnote))
                        mark = f" [{len(notes)}]"
                    rows.append([f.topic, r["display"] + mark, "; ".join(r["conditions"]) or "—", self.numbers[f.local]])
                B.append(dict(kind="table", caption=f"Table {n}.A — {SECTION_TITLES[s]}: summary of key terms ({self.state})",
                              header=["Term", "Value", "Conditions", "Provision"], rows=rows, notes=notes,
                              facts=[f.fact_id for f in table_facts], widths=[0.38, 0.2, 0.3, 0.12]))
            if s == "forms":
                links = D.FORM_FACTS.get(self.p["id"], {})
                rows = [[f"{self.p['code']}-{num.split('-')[1]}", title, "All policies" if i == 0 else "Optional"]
                        for i, (num, title) in enumerate(D.FORMS[self.p["id"]])
                        if num not in links or links[num] in self.resolved]
                rows.append([f"{self.p['code']}-{self.state}-AE", f"{self.state_name} Amendatory Endorsement", "All policies"])
                B.append(dict(kind="table", caption=f"Table {n}.B — Forms schedule", header=["Form", "Title", "Use"],
                              rows=rows, notes=[], facts=[], widths=[0.2, 0.55, 0.25]))
            if present:
                f = present[scen.randrange(len(present))]
                B.append(dict(kind="scenario", text=scen.choice(P.SCENARIOS).format(
                    **self.ctx(topic_lc=f.topic.lower(), number=self.numbers[f.local], value=self.resolved[f.local]["display"]))))
                B.append(dict(kind="table", caption=f"Table {n}.C — Producer checklist", header=["Check", f"{self.state} figure", "Provision"],
                              rows=[[f"Confirm the {f.topic.lower()}", self.resolved[f.local]["display"], self.numbers[f.local]] for f in present],
                              notes=[], facts=[f.fact_id for f in present], widths=[0.55, 0.3, 0.15]))
                B.append(dict(kind="table", caption=f"Table {n}.D — Referral guide", header=["Situation", "Action", "Provision"],
                              rows=[[f"Request outside the {self.state} {f.topic.lower()} of {self.resolved[f.local]['display']}",
                                     REFERRAL_ACTIONS[s], self.numbers[f.local]] for f in present],
                              notes=[], facts=[f.fact_id for f in present], widths=[0.55, 0.3, 0.15]))
                qa = [(f"What is the {f.topic.lower()} for {self.p['display_name']} in {self.state_name}?",
                       self.resolved[f.local]["text"] + f" (Section {self.numbers[f.local]}.)") for f in present]
                B.append(dict(kind="qa", items=qa))
        B.append(dict(kind="h1", number="A", title="Appendix A — Glossary", anchor="glossary"))
        gl = D.GLOSSARY_FACTS.get(self.p["id"], {})
        terms = sorted(t for t in D.COMMON_GLOSSARY + D.FAMILY_GLOSSARY[self.p["id"]] if t[0] not in gl or gl[t[0]] in self.resolved)
        B.append(dict(kind="table", caption="Defined terms", header=["Term", "Meaning"], rows=[list(t) for t in terms],
                      notes=[], facts=[], widths=[0.28, 0.72]))
        B.append(dict(kind="h1", number="B", title=f"Appendix B — {self.state_name} State Addendum", anchor="addendum"))
        B.append(dict(kind="p", text=f"The following terms in this guide differ from the countrywide {self.p['family']} baseline in {self.state_name}. Reason codes are explained below the table."))
        diffs = self.state_differences()
        B.append(dict(kind="table", caption=f"State differences — {self.state}", header=["Provision", "Term", "Baseline", self.state, "Reason / synthetic rule"],
                      rows=[[d["section"], d["topic"], d["base"], d["value"], d["reason"] + " / " + d["regulation"]] for d in diffs],
                      notes=[self.c.regulations["disclaimer"]], facts=[d["fact_id"] for d in diffs], widths=[0.1, 0.27, 0.16, 0.22, 0.25]))
        for d in diffs:
            change = (f"not offered in {self.state_name}; the baseline is {d['base']}" if d["value"].startswith("Not offered")
                      else f"{self.state_name} uses {d['value']} in place of the baseline {d['base']}")
            where = f"Section {d['section']}" if d["section"][:1].isdigit() else d["section"]
            B.append(dict(kind="p", facts=[d["fact_id"]], text=f"{d['topic']} ({where}): {change}. "
                          f"{D.REASON_CODES[d['reason']]} Synthetic reference: {d['regulation']}."))
        used = sorted({d["reason"] for d in diffs})
        B.append(dict(kind="table", caption="Reason codes", header=["Code", "Meaning"],
                      rows=[[c, D.REASON_CODES[c]] for c in used], notes=[], facts=[], widths=[0.3, 0.7]))
        B.append(dict(kind="h1", number="C", title="Appendix C — Revision History", anchor="history"))
        hist = [["1.0", "2019-07-01", "Initial edition of the state guide."]]
        changes = self.changes()
        if self.edition >= 2:
            hist.append(["2.0", self.ed["effective_date"], f"Edition 2 product refresh: {len(changes)} substantive term change(s); modern layout; editable ODT source."])
        B.append(dict(kind="table", caption="Revisions", header=["Revision", "Effective", "Summary"], rows=hist, notes=[], facts=[],
                      widths=[0.15, 0.2, 0.65]))
        if changes:
            B.append(dict(kind="table", caption="Edition 2 term changes", header=["Term", "Edition 1", "Edition 2"],
                          rows=[[ch["topic"], ch["before"], ch["after"]] for ch in changes], notes=[],
                          facts=[ch["fact_id"] for ch in changes], widths=[0.5, 0.25, 0.25]))

    def _details(self, f, r, n, changes):
        h = int(hashlib.sha256(f.fact_id.encode()).hexdigest(), 16)
        c = self.ctx(topic_lc=f.topic.lower(), value=r["display"], number=self.numbers[f.local], sec=n)
        out = []
        if f.section_id in P.GUIDANCE:
            g = P.GUIDANCE[f.section_id]
            out.append(g[h % len(g)].format(**c))
        out.append(P.DOCUMENTATION[(h >> 4) % len(P.DOCUMENTATION)].format(**c))
        out.append(P.EXAMPLES[(h >> 8) % len(P.EXAMPLES)].format(**c))
        o = r["override"]
        if o and o["edition"] == 1 and r["value"] != f.value:
            out.append(f"{self.state_name} note: this figure differs from the countrywide {self.p['family']} baseline of "
                       f"{fmt_value(f.value, f.unit)} ({D.REASON_CODES[o['reason']].rstrip('.').lower()}).")
        for ch in changes:
            if ch["local"] == f.local:
                out.append(f"Edition note: changed from {ch['before']} in edition 1 to {ch['after']} in this edition.")
        return out

    def _glance(self):
        def val(local):
            return self.resolved[local]["display"] if local in self.resolved else "Not offered"
        cov = [f for f in self.facts if f.section_id == "coverages" and f.in_table and f.local in self.resolved][:3]
        ded = [f for f in self.facts if f.section_id == "deductibles" and f.in_table and f.local in self.resolved]
        nested = dict(kind="table", header=["Deductible", "Amount"], rows=[[f.topic, val(f.local)] for f in ded], notes=[],
                      facts=[f.fact_id for f in ded], widths=[0.6, 0.4])
        rows = [["Product", self.p["display_name"]], ["State", self.state_name],
                ["Edition", f"{self.ed['label']} — effective {self.ed['effective_date']}"]]
        rows += [[f.topic, val(f.local)] for f in cov]
        rows.append(["Deductibles", nested])
        return dict(kind="table", caption="Table 1.A — At a glance", header=["Item", "Detail"], rows=rows, notes=[],
                    facts=[f.fact_id for f in cov + ded], widths=[0.35, 0.65])

    def all_text_facts(self):
        return {r["fact"].fact_id: r for r in self.resolved.values()}


CHALLENGES = [
    ("C1a", "same_phrase_different_limit", "small-business-cyber", "NY", 2, "coverages.ransomware", "What is the ransomware and extortion sublimit for the New York cyber guide (current edition)?"),
    ("C1b", "same_phrase_different_limit", "small-business-cyber", "NJ", 2, "coverages.ransomware", "What is the ransomware and extortion sublimit for the New Jersey cyber guide (current edition)?"),
    ("C2a", "introduced_in_edition_2", "personal-auto", "OH", 2, "endorsements.rideshare", "Does the Ohio personal auto guide offer rideshare gap coverage, and up to what limit? (edition 2)"),
    ("C2b", "introduced_in_edition_2", "personal-auto", "OH", 1, "endorsements.rideshare", "Does the Ohio personal auto guide offer rideshare gap coverage? (edition 1)"),
    ("C3a", "narrow_eligibility_exception", "renters", "FL", 2, "endorsements.pet_damage", "Can a Florida renter with a pet snake buy the pet damage endorsement?"),
    ("C3b", "narrow_eligibility_exception", "renters", "GA", 2, "endorsements.pet_damage", "Can a Georgia renter with a pet snake buy the pet damage endorsement?"),
    ("C4", "table_value_clarified_by_footnote", "commercial-property", "TX", 2, "deductibles.wind", "What windstorm deductible applies to an inland (non-coastal) Texas commercial property location?"),
    ("C5a", "answer_absent_in_state", "personal-umbrella", "TX", 2, "endorsements.um_excess", "What excess uninsured motorist limit is available on a Texas personal umbrella?"),
    ("C5b", "answer_absent_in_state", "personal-umbrella", "OK", 2, "endorsements.um_excess", "What excess uninsured motorist limit is available on an Oklahoma personal umbrella?"),
    ("C6a", "edition_change", "small-business-cyber", "NY", 1, "waiting.bi_wait", "What is the cyber business interruption waiting period in New York, edition 1?"),
    ("C6b", "edition_change", "small-business-cyber", "NY", 2, "waiting.bi_wait", "What is the cyber business interruption waiting period in New York, edition 2?"),
    ("C6c", "multi_state_comparison", "small-business-cyber", "NJ", 2, "waiting.bi_wait", "What is the cyber business interruption waiting period in New Jersey, edition 2?"),
    ("C6d", "multi_state_comparison", "small-business-cyber", "PA", 2, "waiting.bi_wait", "What is the cyber business interruption waiting period in Pennsylvania, edition 2?"),
]


ELIGIBILITY_SCENARIOS = [
    dict(
        id="E1",
        product_id="personal-umbrella",
        state="WA",
        edition=2,
        question="Does Silly Goose Mutual cover a 50-foot watercraft worth $2.6 million in Washington?",
        inputs={"watercraft_length_feet": 50, "watercraft_value_usd": 2600000, "use": "private recreational use"},
        expected_decision="ineligible",
        deciding_facts=["eligibility.watercraft_max_length", "eligibility.watercraft_max_value", "eligibility.watercraft_use"],
        expected_reason="The watercraft exceeds both the Washington maximum eligible length of 40 feet and maximum eligible value of $2,000,000.",
    ),
]


def eligibility_scenario_expectations(corpus: Corpus):
    out = []
    for x in ELIGIBILITY_SCENARIOS:
        p = next(p for p in corpus.products if p["id"] == x["product_id"])
        item = dict(x)
        item["document_id"] = corpus.doc_id(p, x["state"], x["edition"])
        item["deciding_fact_ids"] = [corpus.fact(x["product_id"], local).fact_id for local in x["deciding_facts"]]
        item["expected_citations"] = [
            dict(fact_id=corpus.fact(x["product_id"], local).fact_id,
                 value=fmt_value(corpus.resolve_fact(corpus.fact(x["product_id"], local), x["state"], x["edition"])[0],
                                 corpus.fact(x["product_id"], local).unit))
            for local in x["deciding_facts"]
        ]
        out.append(item)
    return out


def challenge_expectations(corpus: Corpus):
    out = []
    for cid, kind, pid, st, ed, local, q in CHALLENGES:
        p = next(x for x in corpus.products if x["id"] == pid)
        f = corpus.fact(pid, local)
        v, conds, o = corpus.resolve_fact(f, st, ed)
        item = dict(id=cid, kind=kind, question=q, product_id=pid, state=st, edition=ed,
                    document_id=corpus.doc_id(p, st, ed), fact_id=f.fact_id,
                    expected_value=fmt_value(v, f.unit) if v is not None else None,
                    expected_conditions=conds if v is not None else [], answer_present=v is not None)
        if cid == "C4":
            aop = corpus.fact(pid, "deductibles.aop")
            item["expected_value"] = fmt_value(corpus.resolve_fact(aop, st, ed)[0], aop.unit)
            item["supporting_fact_ids"] = [f.fact_id, aop.fact_id]
            item["note"] = "Table shows the windstorm percentage; its footnote says inland locations use the all-other-perils deductible."
        out.append(item)
    return out
