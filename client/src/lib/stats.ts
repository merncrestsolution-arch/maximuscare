export interface VisitStats {
  colomboHome: number;
  colomboClinic: number;
  bandaragamaHome: number;
  bandaragamaClinic: number;
}

export function calculateVisitStats(visits: import('./types').Visit[]): VisitStats {
  return visits.reduce((acc, visit) => {
    const branch = (visit.branch || '').trim();
    const type = (visit.visitType || '').trim();
    const isColombo = branch.toLowerCase() === 'colombo';
    const isBandaragama = branch.toLowerCase() === 'bandaragama';
    const isHome = type.toLowerCase() === 'home';

    if (isColombo) {
      if (isHome) acc.colomboHome++;
      else acc.colomboClinic++;
    } else if (isBandaragama) {
      if (isHome) acc.bandaragamaHome++;
      else acc.bandaragamaClinic++;
    }
    return acc;
  }, {
    colomboHome: 0,
    colomboClinic: 0,
    bandaragamaHome: 0,
    bandaragamaClinic: 0
  });
}
