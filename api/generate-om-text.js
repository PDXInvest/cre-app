import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const PROMPTS = {
  investment_summary: (ctx) => `Write a compelling investment summary for a commercial real estate offering memorandum. The property is:

${ctx.property_name} at ${ctx.address}, ${ctx.city_state}
${ctx.total_units} units, built ${ctx.year_built}, ${ctx.building_sf} SF
Neighborhood: ${ctx.neighborhood}
Asking price: ${ctx.asking_price}, Cap rate: ${ctx.current_cap}
${ctx.unit_notes ? 'Unit notes/renovations: ' + ctx.unit_notes : ''}

Write a headline (short, punchy, under 10 words) and a 2-3 sentence lede paragraph that positions the property as a compelling investment. Focus on the key value proposition — location, condition, income, or upside potential. Use a confident, professional tone appropriate for institutional investors. Return JSON: {"headline": "...", "lede": "..."}`,

  investment_highlights: (ctx) => `Write 6 investment highlights for a commercial real estate offering memorandum. The property is:

${ctx.property_name} at ${ctx.address}, ${ctx.city_state}
${ctx.total_units} units, built ${ctx.year_built}, ${ctx.building_sf} SF
Neighborhood: ${ctx.neighborhood}
Asking price: ${ctx.asking_price}
Current cap: ${ctx.current_cap}, Pro forma cap: ${ctx.pro_forma_cap}
Unit mix: ${ctx.unit_mix}
${ctx.unit_notes ? 'Renovations/notes: ' + ctx.unit_notes : ''}

Write 6 highlights, each with a short title (3-5 words) and a 1-2 sentence description. Focus on: location, condition, income stability, upside potential, market trends, and financing. Return JSON: {"highlights": [{"title": "...", "description": "..."}, ...]}`,

  location_highlights: (ctx) => `Write 6 location highlights for a commercial real estate offering memorandum. The property is at:

${ctx.address}, ${ctx.city_state}
Neighborhood: ${ctx.neighborhood}
Walk Score: ${ctx.walk_score}, Bike Score: ${ctx.bike_score}

Write 6 location-focused highlights, each with a short title (3-5 words) and 1-2 sentence description. Cover walkability, transit, dining/retail, parks, schools, and neighborhood character. Return JSON: {"highlights": [{"title": "...", "description": "..."}, ...]}`,

  market_narrative: (ctx) => `Write a market narrative for a commercial real estate offering memorandum. The property is in:

Sub-market: ${ctx.sub_market}
Median cap rate: ${ctx.median_cap}
Median price per unit: ${ctx.median_ppu}
Sales volume (6mo): ${ctx.sales_volume_6mo}
Sales count (12mo): ${ctx.sales_count}
Median days on market: ${ctx.median_dom}

Write a headline and 2-3 paragraph narrative about the local multifamily market conditions, trends, and outlook. Be specific with the data provided. Professional tone. Return JSON: {"headline": "...", "narrative": "..."}`,

  sales_letter: (ctx) => `Write a sales letter for a commercial real estate offering. The property is:

${ctx.property_name} at ${ctx.address}, ${ctx.city_state}
${ctx.total_units} units, built ${ctx.year_built}
Asking price: ${ctx.asking_price}
Current cap: ${ctx.current_cap}, Pro forma cap: ${ctx.pro_forma_cap}
Neighborhood: ${ctx.neighborhood}
Market: ${ctx.sub_market}, Median cap: ${ctx.median_cap}

Write a professional sales letter (3-4 paragraphs) from a broker to a potential buyer. Open with the opportunity, describe the property and its investment merits, mention the market context, and close with a call to action. Return JSON: {"salutation": "Dear Investor,", "body": "...", "closing": "Best regards,"}`,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { page, context } = req.body
  if (!page || !PROMPTS[page]) return res.status(400).json({ error: 'Invalid page type' })
  if (!context) return res.status(400).json({ error: 'No context provided' })

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: PROMPTS[page](context) }],
    })
    const text = response.content[0].text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return res.status(422).json({ error: 'Could not parse response' })
    return res.status(200).json(JSON.parse(jsonMatch[0]))
  } catch (err) {
    console.error('generate-om-text error:', err)
    return res.status(500).json({ error: err.message || 'Generation failed' })
  }
}
