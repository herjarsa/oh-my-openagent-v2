export type NormalizedEvent = {
  readonly type: string
  readonly properties: Record<string, unknown> & { readonly sessionID?: string }
}

function readSessionID(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const record = value as Record<string, unknown>
  const direct = record["sessionID"]
  if (typeof direct === "string" && direct.length > 0) return direct
  const id = record["id"]
  if (typeof id === "string" && id.length > 0) return id
  for (const key of ["session", "info", "data", "event"] as const) {
    const nested = record[key]
    if (typeof nested === "object" && nested !== null) {
      const found = readSessionID(nested)
      if (found !== undefined) return found
    }
  }
  return undefined
}

export function normalizeEvent(input: unknown): NormalizedEvent | undefined {
  if (typeof input !== "object" || input === null) return undefined
  const record = input as Record<string, unknown>
  const type = record["type"]
  if (typeof type !== "string" || type.length === 0) return undefined
  const payload = record["data"] ?? record["properties"]
  const properties: Record<string, unknown> & { sessionID?: string } =
    typeof payload === "object" && payload !== null ? { ...(payload as Record<string, unknown>) } : {}
  const sessionID = readSessionID(record["data"] ?? record["properties"] ?? record["event"] ?? record)
  if (sessionID !== undefined) properties.sessionID = sessionID
  return { type, properties }
}