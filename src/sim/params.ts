// Every tunable number in the model lives here. Time unit is one week.

export const DEFAULT_PARAMS = {
  // --- A tie has two parts. Contact is how much two people have seen of each other lately;
  // depth is how much they matter to each other. Closeness = depth + (1 - depth) * contact.
  // Contact fades with this half-life, in weeks, whatever the tie.
  hlContact: 26,
  // Depth fades far more slowly. Its half-life in weeks grows with how deep the tie ever got.
  hlMin: 80,
  hlMax: 400,
  hlPow: 1,
  // Long-held ties fade more slowly: half-life is multiplied by 1 + hlPerYear * years known, up to hlAgeMax.
  hlPerYear: 0.08,
  hlAgeMax: 3,
  hlKin: 800,

  // --- Circle thresholds on closeness: acquaintance, friend, close friend, inner circle.
  levels: [0.05, 0.18, 0.4, 0.62],

  // --- Mixing at work.
  workAttend: 0.9,
  workTries: 2,
  workOpen: 0.3,
  workGain: 0.05,
  workCap: 0.3,
  // Chance of talking to someone you already know = knownBase + knownBias * strength.
  knownBase: 0.3,
  knownBias: 1.5,

  // --- Open venues (bars, cafes, parks).
  hangTries: 1,
  hangOpen: 0.04,
  hangKnownBase: 0.25,
  hangKnownBias: 0.5,
  hangGain: 0.05,
  hangCap: 0.25,

  // --- Plans with friends. The only context, besides family time, that builds depth.
  outingGain: 0.1,
  outingContact: 0.5,
  depthGain: 0.04,
  // How deep two people can get depends on their fit: ceiling = capBase + capCompat * compatibility, at most depthMax.
  capBase: 0.3,
  capCompat: 0.75,
  depthMax: 0.95,
  // Seeing an old friend again restores this share of the depth that had faded.
  rekindle: 0.2,
  // Chance someone's partner comes along to plans.
  plusOne: 0.4,
  introChance: 0.7,
  hostBase: 0.25,
  hostExt: 0.45,
  hostAway: 0.8,
  inviteMin: 0.08,
  // Invite weight is strength^invitePow: higher concentrates time on the closest few.
  invitePow: 1.6,
  newWindow: 12,
  newBoost: 3,
  acceptBase: 0.45,
  acceptStrength: 0.5,

  // --- Family and long-distance contact.
  familyGain: 0.12,
  familyContact: 0.5,
  // Ceiling on depth between relatives.
  familyCap: 0.9,
  familyDinner: 0.25,
  visitRate: 0.05,
  callBase: 0.25,
  callExt: 0.35,
  callMin: 0.15,
  callGain: 0.04,
  callCap: 0.3,
  // A call restores this share of faded depth. It cannot add depth that was never there.
  callHold: 0.05,

  // --- First impressions: a new tie gets a one-off bonus of sparkMax * u^sparkPow.
  sparkMax: 0.3,
  sparkPow: 4,

  // --- Going out alone.
  soloBase: 0.2,
  soloExt: 0.6,
  soloSecond: 0.3,
  exploreBase: 0.15,
  exploreNovelty: 0.5,
  maxHaunts: 8,

  // --- Life events (annual rates).
  moveYoung: 0.08,
  moveMid: 0.035,
  moveOld: 0.012,
  // Nobody moves again within this many weeks of their last move.
  moveCooldown: 104,
  homePull: 2,
  friendPull: 1.5,
  jobYoung: 0.14,
  jobOld: 0.07,
  referral: 0.3,

  // --- Age. Openness to new people and how often people go out both decline from age 25.
  ageOpenSlope: 0.015,
  ageOpenMin: 0.4,
  ageActiveSlope: 0.01,
  ageActiveMin: 0.6,
  // From this age people stop going to work. They keep their clubs and friends.
  retireAge: 67,

  // --- Partners. Each week a single person may get together with a close, compatible friend.
  partnerSeek: 0.002,
  partnerMinAge: 24,
  partnerCompat: 0.45,
  partnerAgeGap: 8,
  partnerMaxAge: 60,

  // --- Hobbies and clubs (weekly rates).
  clubJoin: 0.1,
  hobbyDrift: 0.002,
  followFriend: 0.6,

  // --- Bookkeeping.
  reunionGap: 156,
  cacheMin: 0.06,
  pruneBelow: 0.02,
};

export type Params = typeof DEFAULT_PARAMS;
