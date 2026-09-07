import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireAdmin } from '@/lib/api';
import { prisma } from '@/lib/db';

const apiKeySettingKey = 'HASIBWEB_WA_API_KEY';
const sessionIdSettingKey = 'HASIBWEB_WA_SESSION_ID';
const crmNameSettingKey = 'CRM_NAME';
const clientDashboardLinkSettingKey = 'CLIENT_DASHBOARD_LINK';

const schema = z.object({
  apiKey: z.string().trim().optional().nullable(),
  sessionId: z.string().trim().optional().nullable(),
  crmName: z.string().trim().optional().nullable(),
  clientDashboardLink: z.string().trim().optional().nullable(),
});

async function getSettingValue(key: string, fallback: string) {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  return setting?.value || fallback;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;

  const [apiKey, sessionId, crmName, clientDashboardLink] = await Promise.all([
    getSettingValue(apiKeySettingKey, ''),
    getSettingValue(sessionIdSettingKey, ''),
    getSettingValue(crmNameSettingKey, ''),
    getSettingValue(clientDashboardLinkSettingKey, ''),
  ]);

  return NextResponse.json({ apiKey, sessionId, crmName, clientDashboardLink });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const input = schema.parse(await request.json());
    await prisma.$transaction([
      prisma.appSetting.upsert({
        where: { key: apiKeySettingKey },
        create: { key: apiKeySettingKey, value: input.apiKey || '' },
        update: { value: input.apiKey || '' },
      }),
      prisma.appSetting.upsert({
        where: { key: sessionIdSettingKey },
        create: { key: sessionIdSettingKey, value: input.sessionId || '' },
        update: { value: input.sessionId || '' },
      }),
      prisma.appSetting.upsert({
        where: { key: crmNameSettingKey },
        create: { key: crmNameSettingKey, value: input.crmName || '' },
        update: { value: input.crmName || '' },
      }),
      prisma.appSetting.upsert({
        where: { key: clientDashboardLinkSettingKey },
        create: { key: clientDashboardLinkSettingKey, value: input.clientDashboardLink || '' },
        update: { value: input.clientDashboardLink || '' },
      }),
    ]);

    return NextResponse.json({
      apiKey: input.apiKey || '',
      sessionId: input.sessionId || '',
      crmName: input.crmName || '',
      clientDashboardLink: input.clientDashboardLink || '',
    });
  } catch (error) {
    return jsonError(error);
  }
}
