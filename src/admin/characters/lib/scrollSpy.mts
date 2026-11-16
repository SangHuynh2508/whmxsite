// IntersectionObserver hands its callback only the entries whose state changed, so the active unit is picked from
// every unit still inside the band (kept in `visible`), not from the latest batch — during a smooth scroll the batch
// can hold only a lower unit while the one at the top has been in view all along.
// Active = the unit crossing the band's top edge `line` (the lowest top at or above it); a tall unit above it that
// only touches the band does not count. With none at or above the edge, the highest visible unit.
export function topVisible<T>(visible: Set<T>, entries: { target: T; isIntersecting: boolean }[], top: (target: T) => number, line: number): T | undefined {
  for (const e of entries) {
    if (e.isIntersecting) visible.add(e.target);
    else visible.delete(e.target);
  }
  let crossing: T | undefined, crossingTop = -Infinity, highest: T | undefined, highestTop = Infinity;
  for (const t of visible) {
    const y = top(t);
    if (y <= line + 1 && y > crossingTop) { crossing = t; crossingTop = y; }
    if (y < highestTop) { highest = t; highestTop = y; }
  }
  return crossing ?? highest;
}
