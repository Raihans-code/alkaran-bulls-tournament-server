/* eslint-disable no-console */
// Development seed data.
// !! SECURITY: set ADMIN_EMAIL and ADMIN_PASSWORD in the environment before seeding.
// !! CHANGE IT (and delete the demo owner accounts) BEFORE PRODUCTION.
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { prisma } from '../src/utils/prisma.js';
import { recomputeStandings } from '../src/services/standingService.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@alkaranbulls.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@12345';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'Owner@12345';

const first = ['Rahim', 'Karim', 'Shakib', 'Tamim', 'Mushfiq', 'Sabbir', 'Mahmud', 'Nasir', 'Imran', 'Fahim', 'Rafi', 'Tanvir', 'Arif', 'Jamal', 'Sohel', 'Rony', 'Habib', 'Mithun', 'Zahid', 'Nayeem', 'Riyad', 'Anik', 'Shuvo', 'Masum'];
const last = ['Ahmed', 'Hossain', 'Islam', 'Khan', 'Chowdhury', 'Uddin', 'Rahman', 'Sarker', 'Mia', 'Akter', 'Talukder', 'Bhuiyan', 'Sikder', 'Hasan', 'Miah', 'Das', 'Roy', 'Ali', 'Mondol', 'Kabir', 'Sheikh', 'Alam', 'Reza', 'Karim'];
const categories = ['B','C','D','E','NO_CATEGORY','B','C','A'];
const prices = [300, 500, 500, 800, 1000, 600, 400, 1500];
const teamNames = ['Alkaran Warriors', 'Chattogram Challengers', 'Karnaphuli Kings', 'Patenga Panthers', 'Hill Tract Hawks', 'Sitakunda Strikers', 'Bay Blasters', 'Foy\'s Lake Falcons', 'Port City Titans', 'Alkaran Royals'];

function playerNames(n, offset = 0) {
  const seen = new Set();
  const out = [];
  for (let i = offset; out.length < n; i++) {
    const name = `${first[i % first.length]} ${last[(Math.floor(i / first.length) * 7 + 3) % last.length]}`;
    if (!seen.has(name)) { seen.add(name); out.push(name); }
  }
  return out;
}

let seedState = 42;
const rnd = (min, max) => { seedState = (seedState * 1664525 + 1013904223) % 4294967296; return min + (seedState % (max - min + 1)); };

async function reset() {
  for (const m of ['auditLog', 'matchPlayerStatistic', 'matchScore', 'match', 'squadPlayer', 'auctionBid', 'auction', 'teamStanding', 'player', 'team', 'season', 'user']) {
    await prisma[m].deleteMany();
  }
}

async function main() {
  if (process.argv.includes('--reset')) await reset();
  if (await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })) {
    console.log('Seed data already present. Run `node prisma/seed.js --reset` to rebuild.');
    return;
  }

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const ownerHash = await bcrypt.hash(OWNER_PASSWORD, 12);
  const admin = await prisma.user.create({ data: { name: 'Tournament Admin', email: ADMIN_EMAIL, passwordHash: adminHash, role: 'ADMIN', canScore: true } });
  const owners = [];
  for (let i = 1; i <= 10; i++) {
    owners.push(await prisma.user.create({ data: { name: `Owner ${i}`, email: `owner${i}@alkaranbulls.com`, phone: `0170000000${i - 1}`, passwordHash: ownerHash, role: 'OWNER' } }));
  }

  // ---------- Season 2: completed, for history ----------
  const s2 = await prisma.season.create({ data: { name: 'Alkaran Bulls Season 2', seasonNumber: 2, year: 2026, description: 'Last year\'s tournament', status: 'COMPLETED', startDate: new Date('2026-01-10'), endDate: new Date('2026-02-20'), maxTeams: 4, maxPlayersPerTeam: 8, initialTeamBudget: 10000, bidIncrement: 100 } });
  const s2Teams = [];
  const s2Names = playerNames(32, 5);
  for (let t = 0; t < 4; t++) {
    const team = await prisma.team.create({ data: { name: teamNames[t], ownerId: owners[t].id, seasonId: s2.id, purse: 0, registrationStatus: 'APPROVED' } });
    s2Teams.push(team);
    let spent = 0;
    for (let k = 0; k < 8; k++) {
      const idx = t * 8 + k;
      const price = prices[idx % prices.length] + 100 * (idx % 4);
      spent += price;
      const player = await prisma.player.create({ data: { name: s2Names[idx], seasonId: s2.id, category: categories[idx % categories.length], basePrice: prices[idx % prices.length], status: 'SOLD', currentTeamId: team.id, soldPrice: price } });
      await prisma.squadPlayer.create({ data: { seasonId: s2.id, teamId: team.id, playerId: player.id, price } });
    }
    await prisma.team.update({ where: { id: team.id }, data: { purse: 10000 - spent } });
  }
  let num = 1;
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    const [A, B] = [s2Teams[a], s2Teams[b]];
    const r1 = rnd(70, 130); const r2 = rnd(60, 135);
    const winner = r2 > r1 ? B : r1 > r2 ? A : null;
    const match = await prisma.match.create({
      data: {
        seasonId: s2.id, matchNumber: num++, teamAId: A.id, teamBId: B.id, venue: 'Alkaran Ground', scheduledAt: new Date(2026, 0, 12 + num * 3), oversLimit: 10, status: 'COMPLETED',
        resultType: winner ? 'WIN' : 'TIE', winnerId: winner?.id ?? null,
        resultText: winner ? `${winner.name} won by ${winner.id === B.id ? rnd(1, 5) + ' wickets' : r1 - r2 + ' runs'}` : 'Match tied',
      },
    });
    await prisma.matchScore.createMany({ data: [
      { matchId: match.id, inningsNumber: 1, battingTeamId: A.id, bowlingTeamId: B.id, runs: r1, wickets: rnd(2, 6), balls: 60, status: 'COMPLETED' },
      { matchId: match.id, inningsNumber: 2, battingTeamId: B.id, bowlingTeamId: A.id, runs: r2, wickets: rnd(1, 6), balls: rnd(40, 60), target: r1 + 1, status: 'COMPLETED' },
    ] });
    for (const team of [A, B]) {
      const squad = await prisma.squadPlayer.findMany({ where: { teamId: team.id }, take: 2, orderBy: { createdAt: 'asc' } });
      for (const [i, sp] of squad.entries()) {
        await prisma.matchPlayerStatistic.create({ data: { matchId: match.id, playerId: sp.playerId, runs: rnd(10, 60), ballsFaced: rnd(10, 35), fours: rnd(0, 6), sixes: rnd(0, 4), wickets: i === 1 ? rnd(0, 3) : 0, ballsBowled: i === 1 ? 12 : 0, runsConceded: i === 1 ? rnd(8, 30) : 0 } });
      }
    }
  }
  await recomputeStandings(prisma, s2.id);
  const champ = await prisma.teamStanding.findFirst({ where: { seasonId: s2.id }, orderBy: [{ points: 'desc' }, { netRunRate: 'desc' }] });
  await prisma.season.update({ where: { id: s2.id }, data: { championTeamId: champ.teamId } });

  // ---------- Season 3: current, in AUCTION stage ----------
  const s3 = await prisma.season.create({ data: { name: 'Alkaran Bulls Season 3', seasonNumber: 3, year: 2027, description: 'Season 3: live player auction', status: 'AUCTION', startDate: new Date('2027-01-15'), maxTeams: 10, maxPlayersPerTeam: 8, initialTeamBudget: 10000, bidIncrement: 100 } });
  const s3Teams = [];
  for (let t = 0; t < 10; t++) {
    s3Teams.push(await prisma.team.create({ data: { name: t === 0 ? 'Alkaran Bulls XI' : teamNames[t], ownerId: owners[t].id, seasonId: s3.id, purse: s3.initialTeamBudget, registrationStatus: 'APPROVED', contactInfo: owners[t].phone } }));
    await prisma.teamStanding.create({ data: { teamId: s3Teams[t].id, seasonId: s3.id } });
  }
  const s3Names = playerNames(24, 11);
  const s3Players = [];
  for (let i = 0; i < 24; i++) {
    const category = i < 4 ? 'A' : categories[i % categories.length];
    s3Players.push(await prisma.player.create({ data: { name: s3Names[i], seasonId: s3.id, category, basePrice: category === 'A' ? 1500 : prices[i % prices.length], phone: `018000000${String(i).padStart(2, '0')}` } }));
  }
  // Two players per team already sold so squad counters and purses look real (max is still 8).
  for (let t = 0; t < 10; t++) {
    for (let k = 0; k < 2; k++) {
      const p = s3Players[t * 2 + k];
      
      const price = p.basePrice + 100 * ((t + k) % 5);
      await prisma.squadPlayer.create({ data: { seasonId: s3.id, teamId: s3Teams[t].id, playerId: p.id, price } });
      await prisma.player.update({ where: { id: p.id }, data: { status: 'SOLD', currentTeamId: s3Teams[t].id, soldPrice: price } });
      await prisma.team.update({ where: { id: s3Teams[t].id }, data: { purse: { decrement: price } } });
    }
  }
  const upcoming = [[0, 1], [2, 3], [4, 5], [6, 7]];
  for (const [i, [a, b]] of upcoming.entries()) {
    await prisma.match.create({ data: { seasonId: s3.id, matchNumber: i + 1, teamAId: s3Teams[a].id, teamBId: s3Teams[b].id, venue: 'Alkaran Ground', scheduledAt: new Date(2027, 1, 5 + i), oversLimit: 10 } });
  }

  // ---------- Season 4: complete demo tournament, for the full user experience ----------
  const s4 = await prisma.season.create({ data: { name: 'Alkaran Bulls Season 4', seasonNumber: 4, year: 2028, description: 'Demo tournament with auction history, live scoring and standings', status: 'RUNNING', startDate: new Date('2028-01-10'), maxTeams: 10, maxPlayersPerTeam: 8, initialTeamBudget: 10000, bidIncrement: 100 } });
  const s4Teams = [];
  for (let t = 0; t < 10; t++) {
    const team = await prisma.team.create({ data: { name: teamNames[t], ownerId: owners[t].id, seasonId: s4.id, purse: s4.initialTeamBudget, registrationStatus: 'APPROVED', contactInfo: owners[t].phone } });
    s4Teams.push(team);
    await prisma.teamStanding.create({ data: { teamId: team.id, seasonId: s4.id } });
  }

  const s4Players = [];
  const s4Names = playerNames(80, 35);
  for (let t = 0; t < 10; t++) {
    for (let k = 0; k < 8; k++) {
      const index = t * 8 + k;
      const category = k === 0 ? 'A' : categories[(index + 2) % categories.length];
      const basePrice = category === 'A' ? 1500 : prices[index % prices.length];
      const soldPrice = basePrice + 100 * ((index % 4) + 1);
      const player = await prisma.player.create({ data: { name: s4Names[index], seasonId: s4.id, category, basePrice, status: 'SOLD', currentTeamId: s4Teams[t].id, soldPrice, phone: `0190000${String(index).padStart(4, '0')}` } });
      s4Players.push(player);
      await prisma.squadPlayer.create({ data: { seasonId: s4.id, teamId: s4Teams[t].id, playerId: player.id, price: soldPrice } });
      const auction = await prisma.auction.create({ data: { seasonId: s4.id, playerId: player.id, status: 'SOLD', basePrice, currentBid: soldPrice, highestBidTeamId: s4Teams[t].id, startedAt: new Date(2028, 0, 2, 9, index), endedAt: new Date(2028, 0, 2, 9, index + 1) } });
      await prisma.auctionBid.createMany({ data: [
        { auctionId: auction.id, teamId: s4Teams[(t + 1) % 10].id, amount: basePrice },
        { auctionId: auction.id, teamId: s4Teams[t].id, amount: soldPrice },
      ] });
      await prisma.team.update({ where: { id: s4Teams[t].id }, data: { purse: { decrement: soldPrice } } });
    }
  }

  const createCompletedDemoMatch = async (matchNumber, aIndex, bIndex, runsA, runsB) => {
    const teamA = s4Teams[aIndex];
    const teamB = s4Teams[bIndex];
    const winner = runsA >= runsB ? teamA : teamB;
    const match = await prisma.match.create({ data: { seasonId: s4.id, matchNumber, teamAId: teamA.id, teamBId: teamB.id, venue: 'Alkaran Ground', scheduledAt: new Date(2028, 0, 12 + matchNumber), oversLimit: 10, status: 'COMPLETED', resultType: runsA === runsB ? 'TIE' : 'WIN', winnerId: runsA === runsB ? null : winner.id, resultText: runsA === runsB ? 'Match tied' : `${winner.name} won by ${Math.abs(runsA - runsB)} runs`, playerOfMatchId: s4Players[aIndex * 8].id } });
    await prisma.matchScore.createMany({ data: [
      { matchId: match.id, inningsNumber: 1, battingTeamId: teamA.id, bowlingTeamId: teamB.id, runs: runsA, wickets: 5, balls: 60, status: 'COMPLETED' },
      { matchId: match.id, inningsNumber: 2, battingTeamId: teamB.id, bowlingTeamId: teamA.id, runs: runsB, wickets: 6, balls: 60, target: runsA + 1, status: 'COMPLETED' },
    ] });
    for (const teamIndex of [aIndex, bIndex]) {
      for (let k = 0; k < 2; k++) {
        await prisma.matchPlayerStatistic.create({ data: { matchId: match.id, playerId: s4Players[teamIndex * 8 + k].id, runs: 20 + k * 15 + matchNumber, ballsFaced: 12 + k * 4, fours: 2 + k, sixes: k, wickets: k, ballsBowled: k ? 12 : 0, runsConceded: k ? 18 : 0 } });
      }
    }
  };

  await createCompletedDemoMatch(1, 0, 1, 126, 112);
  await createCompletedDemoMatch(2, 2, 3, 98, 101);
  await createCompletedDemoMatch(3, 4, 5, 119, 119);
  await createCompletedDemoMatch(4, 6, 7, 137, 125);
  await createCompletedDemoMatch(5, 8, 9, 108, 115);
  await createCompletedDemoMatch(6, 0, 2, 132, 121);
  await createCompletedDemoMatch(7, 4, 6, 111, 116);
  await recomputeStandings(prisma, s4.id);

  const liveMatch = await prisma.match.create({ data: { seasonId: s4.id, matchNumber: 8, teamAId: s4Teams[1].id, teamBId: s4Teams[3].id, venue: 'Alkaran Ground', scheduledAt: new Date(2028, 1, 2, 15), oversLimit: 10, status: 'LIVE' } });
  await prisma.matchScore.create({ data: { matchId: liveMatch.id, inningsNumber: 1, battingTeamId: s4Teams[1].id, bowlingTeamId: s4Teams[3].id, runs: 74, wickets: 2, balls: 42, status: 'IN_PROGRESS', strikerId: s4Players[8].id, nonStrikerId: s4Players[9].id, bowlerId: s4Players[24].id } });
  await prisma.matchScore.create({ data: { matchId: liveMatch.id, inningsNumber: 2, battingTeamId: s4Teams[3].id, bowlingTeamId: s4Teams[1].id, target: 75, status: 'NOT_STARTED' } });
  await prisma.matchPlayerStatistic.createMany({ data: [
    { matchId: liveMatch.id, playerId: s4Players[8].id, runs: 31, ballsFaced: 21, fours: 3, sixes: 1 },
    { matchId: liveMatch.id, playerId: s4Players[9].id, runs: 22, ballsFaced: 14, fours: 2, sixes: 1 },
  ] });
  for (const [matchNumber, aIndex, bIndex] of [[9, 5, 7], [10, 0, 4], [11, 6, 8]]) {
    await prisma.match.create({ data: { seasonId: s4.id, matchNumber, teamAId: s4Teams[aIndex].id, teamBId: s4Teams[bIndex].id, venue: 'Alkaran Ground', scheduledAt: new Date(2028, 1, 3 + matchNumber), oversLimit: 10 } });
  }
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'SEED_COMPLETED', entity: 'System', metadata: { note: 'Development seed data' } } });

  console.log('\nSeed complete.');
  console.log(`  Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Team owners: owner1@alkaranbulls.com ... owner10@alkaranbulls.com / ${OWNER_PASSWORD}`);
  console.log('  !! Change these passwords before production. !!\n');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
