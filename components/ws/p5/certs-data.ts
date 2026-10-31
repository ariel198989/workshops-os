import { listAttendance } from '../../../lib/ws/attendance';
import { listCertificates } from '../../../lib/ws/certificates';
import { listDeliverables, type DeliverableWithGroup } from '../../../lib/ws/deliverables';
import { listGroups } from '../../../lib/ws/groups';
import { listParticipants, type ParticipantWithGroup } from '../../../lib/ws/participants';
import { listSessions } from '../../../lib/ws/workshops';
import type { WsAttendance, WsCertificate, WsGroup, WsSession } from '../../../lib/ws/types';
import { getWorkshopHead, type WorkshopHead } from './api';

export interface CertificatesData {
  head: WorkshopHead;
  participants: ParticipantWithGroup[];
  sessions: WsSession[];
  attendance: WsAttendance[];
  groups: WsGroup[];
  deliverables: DeliverableWithGroup[];
  certificates: WsCertificate[];
}

/** Everything the certificates tab needs, fetched in parallel. */
export async function loadCertificatesData(workshopId: string): Promise<CertificatesData> {
  const [head, participants, sessions, attendance, groups, deliverables, certificates] = await Promise.all([
    getWorkshopHead(workshopId), listParticipants(workshopId), listSessions(workshopId),
    listAttendance(workshopId), listGroups(workshopId), listDeliverables(workshopId), listCertificates(workshopId),
  ]);
  return { head, participants, sessions, attendance, groups, deliverables, certificates };
}

/** share_token of the participant's group (ws_groups, staff read), for the take-home QR on the printed certificate. */
export function shareTokenFor(data: CertificatesData, participantId: string): string | null {
  const groupId = data.participants.find((p) => p.id === participantId)?.group_id;
  if (!groupId) return null;
  return data.groups.find((g) => g.id === groupId)?.share_token ?? null;
}

/** demo_score of the participant's group, used to suggest the distinction variant. */
export function demoScoreFor(data: CertificatesData, participantId: string): number | null {
  const groupId = data.participants.find((p) => p.id === participantId)?.group_id;
  if (!groupId) return null;
  return data.deliverables.find((d) => d.group_id === groupId)?.demo_score ?? null;
}
