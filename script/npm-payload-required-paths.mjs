export function findMissingPayloadPaths(packedPaths, requiredPaths) {
  const packed = new Set(packedPaths)
  return requiredPaths.filter((requiredPath) => !packed.has(requiredPath))
}
