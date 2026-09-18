import { createIcons, UsersRound, Shirt, Sword, Database, Calculator } from 'lucide';

export function initAppNav() {
  createIcons({
    icons: {
      UsersRound,
      Shirt,
      Sword,
      Database,
      Calculator
    },
    attrs: {
      width: 20,
      height: 20,
      'stroke-width': 2,
      stroke: 'currentColor'
    }
  });
}
