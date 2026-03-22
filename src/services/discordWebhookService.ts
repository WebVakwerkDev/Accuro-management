import type { ProjectCreateApiInput } from "@/lib/validations/api";
import type { ProjectCreateResult } from "@/services/projectCreationService";
import { getDiscordTicketWebhookUrl, getNextAuthUrl } from "@/lib/env";

interface SendTicketCreatedNotificationInput {
  request: ProjectCreateApiInput;
  result: ProjectCreateResult;
}

export async function sendTicketCreatedDiscordNotification({
  request,
  result,
}: SendTicketCreatedNotificationInput) {
  const webhookUrl = getDiscordTicketWebhookUrl();
  if (!webhookUrl) return;

  const appUrl = getNextAuthUrl();
  const projectUrl = appUrl ? `${appUrl}/projects/${result.project.id}` : undefined;
  const source = request.source?.label
    ? `${request.source.type} (${request.source.label})`
    : (request.source?.type ?? "internal_api");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Ticket System",
      embeds: [
        {
          title: "Nieuw ticket aangemaakt",
          color: 3447003,
          fields: [
            {
              name: "Project",
              value: `${result.project.name} (${result.project.status})`,
              inline: false,
            },
            {
              name: "Klant",
              value: result.client.companyName,
              inline: true,
            },
            {
              name: "Bron",
              value: source,
              inline: true,
            },
            ...(result.changeRequest
              ? [
                  {
                    name: "Change request",
                    value: result.changeRequest.id,
                    inline: false,
                  },
                ]
              : []),
            ...(projectUrl
              ? [
                  {
                    name: "Project URL",
                    value: projectUrl,
                    inline: false,
                  },
                ]
              : []),
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!response.ok) {
    const message = (await response.text()) || response.statusText;
    throw new Error(`Discord webhook failed (${response.status}): ${message}`);
  }
}