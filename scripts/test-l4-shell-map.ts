/**
 * L4 product shell map drift guard (exec-plan 099).
 * See: packages/cli/src/l4-product-map.ts, docs/.../L4_PRODUCT_SHELL_MAP.md
 */
import {
  assertL4ProductMapInvariants,
  l4ProductShellMapSnapshotLine,
} from '../packages/cli/src/l4-product-map.ts'

assertL4ProductMapInvariants()
console.log(`test:l4-shell-map passed (${l4ProductShellMapSnapshotLine()})`)
