"use server";

import { prisma } from "@/lib/db";

interface SearchResults {
  clients: Array<{ id: string; displayName: string; url: string }>;
  projects: Array<{ id: string; displayName: string; url: string }>;
  changeRequests: Array<{ id: string; displayName: string; url: string }>;
  invoices: Array<{ id: string; displayName: string; url: string }>;
}

export async function globalSearch(query: string): Promise<{
  success: boolean;
  results?: SearchResults;
  error?: string;
}> {
  if (!query || query.trim().length < 2) {
    return {
      success: true,
      results: {
        clients: [],
        projects: [],
        changeRequests: [],
        invoices: [],
      },
    };
  }

  const trimmedQuery = query.trim();

  try {
    const [clients, projects, changeRequests, invoices] = await Promise.all([
      prisma.client.findMany({
        where: {
          OR: [
            {
              companyName: {
                contains: trimmedQuery,
                mode: "insensitive",
              },
            },
            {
              contactName: {
                contains: trimmedQuery,
                mode: "insensitive",
              },
            },
            {
              email: {
                contains: trimmedQuery,
                mode: "insensitive",
              },
            },
          ],
        },
        select: { id: true, companyName: true },
        take: 10,
      }),

      prisma.projectWorkspace.findMany({
        where: {
          OR: [
            {
              name: {
                contains: trimmedQuery,
                mode: "insensitive",
              },
            },
            {
              description: {
                contains: trimmedQuery,
                mode: "insensitive",
              },
            },
            {
              domainName: {
                contains: trimmedQuery,
                mode: "insensitive",
              },
            },
          ],
        },
        select: { id: true, name: true, slug: true },
        take: 10,
      }),

      prisma.changeRequest.findMany({
        where: {
          OR: [
            {
              title: {
                contains: trimmedQuery,
                mode: "insensitive",
              },
            },
            {
              description: {
                contains: trimmedQuery,
                mode: "insensitive",
              },
            },
          ],
        },
        select: {
          id: true,
          title: true,
          project: { select: { slug: true } },
        },
        take: 10,
      }),

      prisma.invoice.findMany({
        where: {
          OR: [
            {
              invoiceNumber: {
                contains: trimmedQuery,
                mode: "insensitive",
              },
            },
            {
              description: {
                contains: trimmedQuery,
                mode: "insensitive",
              },
            },
          ],
        },
        select: { id: true, invoiceNumber: true, description: true },
        take: 10,
      }),
    ]);

    const results: SearchResults = {
      clients: clients.map((c) => ({
        id: c.id,
        displayName: c.companyName,
        url: `/clients/${c.id}`,
      })),
      projects: projects.map((p) => ({
        id: p.id,
        displayName: p.name,
        url: `/projects/${p.slug}`,
      })),
      changeRequests: changeRequests.map((cr) => ({
        id: cr.id,
        displayName: cr.title,
        url: `/projects/${cr.project.slug}/change-requests/${cr.id}`,
      })),
      invoices: invoices.map((inv) => ({
        id: inv.id,
        displayName: `${inv.invoiceNumber} — ${inv.description}`,
        url: `/invoices/${inv.id}`,
      })),
    };

    return { success: true, results };
  } catch (error) {
    console.error("globalSearch error:", error);
    return { success: false, error: "Search failed" };
  }
}
