import { readAuthConfig, readEntraConfig } from '../../server/auth.ts';
import { readSlackChatConfig } from '../../server/chat.ts';
/** Generate only the explicitly configured providers; deployment always requires login. */
export function buildAuthEnv(source: Record<string, string | undefined>, domain: string): Record<string, string> {
  const microsoft = !!source.ENTRA_TENANT_ID;
  const slack = !!source.SLACK_CLIENT_ID;
  if (!microsoft && !slack) throw new Error('Configure Microsoft or Slack login before deployment.');
  const env: Record<string, string> = { REQUIRE_ENTRA_LOGIN: String(microsoft), REQUIRE_SLACK_LOGIN: String(!microsoft), SLACK_CHAT_ENABLED: source.SLACK_CHAT_ENABLED || 'false' };
  if (microsoft) Object.assign(env, { ENTRA_TENANT_ID: source.ENTRA_TENANT_ID, ENTRA_CLIENT_ID: source.ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET: source.ENTRA_CLIENT_SECRET, ENTRA_REDIRECT_URI: `https://${domain}/auth/microsoft/callback` });
  if (slack) Object.assign(env, { SLACK_CLIENT_ID: source.SLACK_CLIENT_ID, SLACK_CLIENT_SECRET: source.SLACK_CLIENT_SECRET, SLACK_TEAM_ID: source.SLACK_TEAM_ID || 'T1MK78MV4', SLACK_REDIRECT_URI: `https://${domain}/auth/slack/callback` });
  if (env.SLACK_CHAT_ENABLED === 'true') for (const k of ['SLACK_BOT_TOKEN','SLACK_SIGNING_SECRET','SLACK_CHAT_TEAM_ID','SLACK_CHAT_CHANNEL_ID','SLACK_CHAT_CHANNEL_NAME']) if(source[k]) env[k] = source[k];
  for (const [key, value] of Object.entries(env)) if (typeof value !== 'string' || /[\r\n]/.test(value)) throw new Error(`Invalid ${key}`);
  readAuthConfig(env); readEntraConfig(env); readSlackChatConfig(env); return env;
}
