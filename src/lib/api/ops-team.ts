import { http } from '@/lib/http';
import type {
  BdeTeamListResponse,
  BdeTeamMemberDetail,
  BdeTeamMemberSummary,
} from '@/shared/types';

export type { BdeTeamListResponse, BdeTeamMemberDetail, BdeTeamMemberSummary };

export function listBdeTeam() {
  return http.get<BdeTeamListResponse>('/ops/team').then((r) => r.data);
}

export function getBdeTeamMember(id: string) {
  return http.get<BdeTeamMemberDetail>(`/ops/team/${encodeURIComponent(id)}`).then((r) => r.data);
}

export function addBdeCoachingNote(id: string, text: string) {
  return http
    .post<BdeTeamMemberDetail>(`/ops/team/${encodeURIComponent(id)}/notes`, { text })
    .then((r) => r.data);
}
