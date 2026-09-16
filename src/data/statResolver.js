/**
 * Centralized Character Stat Resolver
 * Calculates verified character stats for any given level (default 120).
 * No hardcoded defaults, no character-specific exceptions.
 */

export function resolveCharacterStats(char, targetLevel = 120) {
  if (!char || !char.stats) {
    return null;
  }

  const s = char.stats;

  const calc = (base, grow, lvl) => {
    if (base === undefined || base === null) return null;
    if (grow === undefined || grow === null) return base;
    return base + grow * (lvl - 1);
  };

  const hpBase = s.hp_base ?? null;
  const hpTgt = calc(s.hp_base, s.hp_grow, targetLevel);

  const atkBase = s.atk_base ?? null;
  const akTgt = calc(s.atk_base, s.atk_grow, targetLevel);

  const pdefBase = s.def_physic_base ?? null;
  const pdefTgt = calc(s.def_physic_base, s.def_physic_grow, targetLevel);

  const mdefBase = s.def_magic_base ?? null;
  const mdefTgt = calc(s.def_magic_base, s.def_magic_grow, targetLevel);

  return {
    level: targetLevel,
    hp: {
      base: hpBase,
      target: hpTgt,
      grow: s.hp_grow ?? 0,
      verified: hpBase !== null && hpTgt !== null
    },
    atk: {
      base: atkBase,
      target: akTgt,
      grow: s.atk_grow ?? 0,
      verified: atkBase !== null && akTgt !== null
    },
    defPhysic: {
      base: pdefBase,
      target: pdefTgt,
      grow: s.def_physic_grow ?? 0,
      verified: pdefBase !== null && pdefTgt !== null
    },
    defMagic: {
      base: mdefBase,
      target: mdefTgt,
      grow: s.def_magic_grow ?? 0,
      verified: mdefBase !== null && mdefTgt !== null
    },
    speed: s.speed ?? null,
    mov: s.mov ?? null,
    crit: s.crit ?? null,
    critDmg: s.crit_dmg ?? null,
    provenance: s.provenance || {
      source_table: "roleattrMap.json",
      formula: "Stat(level) = Base + GROW * (level - 1)"
    }
  };
}
