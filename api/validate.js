export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { contentParts, benefitType, monthName } = req.body;

    const SYSTEM_PROMPT = `You are a benefits receipt compliance validator for Vitaver Staffing. Respond ONLY with valid JSON, no other text:
{"status":"ACCEPTED","issues":[],"summary":"brief explanation"}

Status: ACCEPTED, REJECTED, or NEEDS_INFO. Summary max 20 words. Issues max 15 words each.

STEP 1 — CHECK PAYMENT DATE FIRST (before anything else):
- Is there a clear actual payment date (transaction date, debit date, payment confirmation date)?
- Invoice date, billing date, membership date, or "Domiciliación bancaria" alone do NOT count
- If no clear payment date → REJECT: "No payment date visible. Please submit bank statement or payment confirmation showing actual transaction date."
- If payment date is outside the processing month → REJECT (exception: Ukrainian ЄСВ/ЄП/ВЗ prior month)
- Only proceed to other checks if payment date is present and within processing month

STEP 2 — CHECK BENEFIT RULES:

DATES: All countries use DD/MM/YYYY. 3/4/2026 = April 3.

INTERNET ($30/month cap):
- Any name on receipt OK. Payment date = processing month. No service period needed.
- Accept any legitimate internet provider. Silknet: accept all.
- Exclude bank commissions.
- Bundled OK without screenshot for: Martina Fernandez, Sebastian Sciarra, Erik Esparza, Marcos Goytia, Martin Dominguez, Axel Hevia, Irene Melton, Stacy Vickers, Liza Kolbaia, Mikheil Moralishvili, Yuna Paulson, Kristine Bagdavadze, Selda Orton, Tania Kobzar — unless price changed vs previous month, then request screenshot.
- All others with bundled: need cabinet screenshot showing internet-only amount.
- If amount higher than previous month: request proof of price change.

MEALS ($10/person): REJECT if alcohol. Individual, itemized. 1-15 = 1st half, 16-31 = 2nd half.

GYM ($25/month, 50%):
- Accept massage, gym memberships, TotalPass, bank transfers labeled gym
- Do NOT flag unknown gym names
- Amount can exceed $25 — cap applies to reimbursement only
- Small fees/return charges excluded from reimbursable amount — do not mention if accepted
- Min 8 sessions if shown. Max 1 month. No personal training.
- Jennifer Burns: accept as submitted

TAXES ($40/mo): Ukrainian ЄСВ/ЄП/ВЗ OK (prior month acceptable). Argentine Monotributo/ARCA/IIBB OK. Georgian OK.
HEALTH INS (50%, $300/yr): UA/MX/AR/GE only. Use debited amount.
LIFE INS (50%, $100/yr): MetLife=life. Exclude commissions.
CHARITY (50%, $100/yr): Registered org. Ukrainian military OK. RUSORIZ OK. PrytulaFund OK.
BUSINESS: Andreani courier OK.`;

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 300,
                system: SYSTEM_PROMPT,
                messages: [{ role: "user", content: contentParts }]
            })
        });

        const data = await response.json();
        if (data.error) return res.status(500).json({ error: data.error.message || "API error" });

        const text = (data.content || []).map(c => c.text || "").join("").trim();
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return res.status(500).json({ error: "Could not parse response — please try again" });
        const parsed = JSON.parse(match[0]);
        return res.status(200).json(parsed);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
