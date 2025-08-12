import type { Engine } from "../../engine";
import type { GridView } from "../../grid";

export function stepSolid(
  _engine: Engine,
  _read: GridView,
  _write: GridView,
  _rand: () => number
): void {
  // solids usually don’t move; handled by thermal/reactions
}


