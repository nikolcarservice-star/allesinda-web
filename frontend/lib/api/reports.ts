import { apiPost } from "./client"

export async function reportMasterProfile(
  profileId: number,
  payload: { reason: string; details?: string }
): Promise<{ ok: boolean; id: number }> {
  return apiPost<{ ok: boolean; id: number }>(
    `/masters/profiles/${profileId}/report`,
    payload
  )
}
