/**
 * Random incentive ideas for instructors to engage and reward students.
 * Each idea can have a quick "Do it" action (actionType) or be manual.
 */

export const INCENTIVE_IDEAS = [
  // Staking & participation
  {
    idea: 'Reward the block proposer with a bonus 0.5 ETH — they earned it by being selected!',
    actionType: 'fundProposer',
    suggestedAmount: 0.5,
    tip: 'Click "Reward proposer" below'
  },
  {
    idea: 'First 3 students to attest this epoch get 0.3 ETH each — encourage timely attestations.',
    actionType: 'fundAttesters',
    suggestedAmount: 0.3,
    tip: 'Use "Reward attesters" after advancing epoch'
  },
  {
    idea: 'Random participation bonus: pick a random student and send them 2 ETH. Announce it in chat!',
    actionType: 'fundRandom',
    suggestedAmount: 2,
    tip: 'Click "Reward random student"'
  },
  {
    idea: 'Everyone who staked this session gets a 0.2 ETH participation bonus.',
    actionType: 'fundAllStakers',
    suggestedAmount: 0.2,
    tip: 'Fund each staker from the table'
  },
  // Role completion
  {
    idea: 'First student to register their role contract gets 1.5 ETH bonus.',
    actionType: 'fundFirstRoleComplete',
    suggestedAmount: 1.5,
    tip: 'Check the Contract column — first to register wins'
  },
  {
    idea: 'All students who completed their role contract get 0.5 ETH — reward the builders!',
    actionType: 'fundRoleCompleters',
    suggestedAmount: 0.5,
    tip: 'Click "Reward role completers"'
  },
  {
    idea: 'Role completion race: first Car Buyer to complete the purchase flow gets 2 ETH.',
    actionType: 'manual',
    suggestedAmount: 2,
    tip: 'Watch the Car Sale — fund the winner when they complete'
  },
  // Scenario-specific
  {
    idea: 'Ransomware: First investigator to submit the correct attacker address gets 3 ETH bounty.',
    actionType: 'manual',
    suggestedAmount: 3,
    tip: 'Use the scenario bounty contract'
  },
  {
    idea: 'Car Sale: Bonus for the mechanic who inspects — 0.5 ETH for honest reporting.',
    actionType: 'manual',
    suggestedAmount: 0.5,
    tip: 'Fund the mechanic after they call mechanicInspect'
  },
  {
    idea: 'Voting participation: Everyone who votes gets 0.1 ETH. Democracy pays!',
    actionType: 'manual',
    suggestedAmount: 0.1,
    tip: 'Check who voted, fund them'
  },
  // Engagement
  {
    idea: 'Cold-call bonus: Pick a random student to explain a concept. Correct answer = 1 ETH.',
    actionType: 'fundRandom',
    suggestedAmount: 1,
    tip: 'Use "Reward random student" after they answer'
  },
  {
    idea: 'Help-a-neighbor: First student to help another debug gets 0.5 ETH.',
    actionType: 'manual',
    suggestedAmount: 0.5,
    tip: 'Observe chat, fund the helper'
  },
  {
    idea: 'Epoch sprint: Next block proposer gets an extra 1 ETH on top of the normal reward.',
    actionType: 'fundProposer',
    suggestedAmount: 1,
    tip: 'Advance epoch, then reward the proposer'
  },
  {
    idea: 'New joiner welcome: Send 1 ETH to the most recent student who joined (chatted or staked).',
    actionType: 'fundNewest',
    suggestedAmount: 1,
    tip: 'Check activity feed for newest participant'
  },
  {
    idea: 'Underdog bonus: Student with the lowest balance gets 2 ETH — help them catch up.',
    actionType: 'fundLowestBalance',
    suggestedAmount: 2,
    tip: 'Click "Reward lowest balance"'
  },
  {
    idea: 'Streak reward: Student who attested the most consecutive epochs gets 1 ETH.',
    actionType: 'manual',
    suggestedAmount: 1,
    tip: 'Check missed attestations — reward those with 0 missed'
  }
];
