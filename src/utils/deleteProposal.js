import { supabase } from '../supabase'

// Delete a proposal and every row that hangs off it. Children are deleted first so this works
// regardless of whether FK ON DELETE CASCADE is configured. The parent property and the shared
// comps are NOT touched (comp_selections is the per-proposal join, which IS removed).
// Returns the Supabase result of the final proposals delete ({ error } is null on success).
export async function deleteProposalCascade(proposalId) {
  if (!proposalId) return { error: new Error('deleteProposalCascade: missing proposalId') }
  await Promise.all([
    supabase.from('comp_selections').delete().eq('proposal_id', proposalId),
    supabase.from('rent_roll_units').delete().eq('proposal_id', proposalId),
    supabase.from('units').delete().eq('proposal_id', proposalId),
    supabase.from('monthly_financials').delete().eq('proposal_id', proposalId),
    supabase.from('proposal_financials').delete().eq('proposal_id', proposalId),
    supabase.from('proposal_dashboard').delete().eq('proposal_id', proposalId),
  ])
  return await supabase.from('proposals').delete().eq('id', proposalId)
}
