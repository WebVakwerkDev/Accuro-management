import { PrismaClient, UserRole, ProjectType, ProjectStatus, ProjectPriority, CommunicationType, ChangeRequestSource, ChangeRequestStatus, ChangeRequestImpact, InvoiceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Users ────────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash(
    process.env.SEED_ADMIN_PASSWORD ?? "admin123!",
    12
  );
  const employeePassword = await bcrypt.hash("employee123!", 12);
  const financePassword = await bcrypt.hash("finance123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: process.env.SEED_ADMIN_EMAIL ?? "admin@agency.nl" },
    update: {},
    create: {
      name: process.env.SEED_ADMIN_NAME ?? "Admin User",
      email: process.env.SEED_ADMIN_EMAIL ?? "admin@agency.nl",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  const devUser = await prisma.user.upsert({
    where: { email: "dev@agency.nl" },
    update: {},
    create: {
      name: "Sander Visser",
      email: "dev@agency.nl",
      passwordHash: employeePassword,
      role: UserRole.EMPLOYEE,
    },
  });

  const financeUser = await prisma.user.upsert({
    where: { email: "finance@agency.nl" },
    update: {},
    create: {
      name: "Laura de Groot",
      email: "finance@agency.nl",
      passwordHash: financePassword,
      role: UserRole.FINANCE,
    },
  });

  console.log("✅ Users created");

  // ─── Clients ──────────────────────────────────────────────────────────────
  const client1 = await prisma.client.upsert({
    where: { id: "client-bakkerij-jansen" },
    update: {},
    create: {
      id: "client-bakkerij-jansen",
      companyName: "Bakkerij Jansen B.V.",
      contactName: "Mark Jansen",
      email: "mark@bakkerijjansen.nl",
      phone: "+31 6 12345678",
      address: "Hoofdstraat 12, 1234 AB Amsterdam",
      vatNumber: "NL123456789B01",
      chamberOfCommerceNumber: "12345678",
      notes: "Vaste klant sinds 2021. Prefereert contact via WhatsApp. Deadlines zijn belangrijk voor hen vanwege seizoensgebonden campagnes.",
      invoiceDetails: "Facturen naar administratie@bakkerijjansen.nl, t.a.v. Mark Jansen",
    },
  });

  const client2 = await prisma.client.upsert({
    where: { id: "client-stichting-duurzaam" },
    update: {},
    create: {
      id: "client-stichting-duurzaam",
      companyName: "Stichting Duurzaam Nederland",
      contactName: "Eva Martens",
      email: "eva.martens@duurzaamnederland.org",
      phone: "+31 20 7654321",
      address: "Keizersgracht 88, 1015 CT Amsterdam",
      vatNumber: null,
      chamberOfCommerceNumber: "87654321",
      notes: "Non-profit. Beperkt budget maar trouwe klant. Altijd goede briefings aanleveren.",
      invoiceDetails: "Facturen naar financien@duurzaamnederland.org",
    },
  });

  const client3 = await prisma.client.upsert({
    where: { id: "client-techstart-bv" },
    update: {},
    create: {
      id: "client-techstart-bv",
      companyName: "TechStart B.V.",
      contactName: "Robin de Vries",
      email: "robin@techstart.io",
      phone: "+31 6 98765432",
      address: "High Tech Campus 5, 5656 AE Eindhoven",
      vatNumber: "NL987654321B01",
      chamberOfCommerceNumber: "11223344",
      notes: "Startup in de fintech sector. Goed in het communiceren van requirements. Snel betaler.",
      invoiceDetails: "Facturen naar robin@techstart.io",
    },
  });

  const client4 = await prisma.client.upsert({
    where: { id: "client-hotel-atlantis" },
    update: {},
    create: {
      id: "client-hotel-atlantis",
      companyName: "Hotel Atlantis Rotterdam",
      contactName: "Sandra Koops",
      email: "s.koops@hotelatlantis.nl",
      phone: "+31 10 4567890",
      address: "Maasboulevard 1, 3063 NS Rotterdam",
      vatNumber: "NL112233445B01",
      chamberOfCommerceNumber: "55667788",
      notes: "Hotelketen met 3 locaties. Wil een booking-widget geïntegreerd op de nieuwe site.",
    },
  });

  console.log("✅ Clients created");

  // ─── Projects ─────────────────────────────────────────────────────────────
  const project1 = await prisma.projectWorkspace.upsert({
    where: { slug: "bakkerij-jansen-nieuwe-website" },
    update: {},
    create: {
      id: "project-bakkerij-jansen-web",
      clientId: client1.id,
      name: "Bakkerij Jansen – Nieuwe Website",
      slug: "bakkerij-jansen-nieuwe-website",
      projectType: ProjectType.NEW_WEBSITE,
      status: ProjectStatus.IN_PROGRESS,
      priority: ProjectPriority.HIGH,
      description: "Complete nieuwe website voor Bakkerij Jansen, inclusief webshop voor online bestellingen van brood en banket.",
      intakeSummary: "Klant wil een moderne, snel ladende website met een eigen webshop. Producten en prijzen worden door de klant zelf beheerd. Integratie met iDEAL en Stripe vereist.",
      scope: "Homepage, over ons, producten pagina, webshop (WooCommerce), contact, blog. SEO-optimalisatie. Mobiel-first design.",
      techStack: "WordPress, WooCommerce, Elementor Pro, Yoast SEO",
      domainName: "bakkerijjansen.nl",
      hostingInfo: "Versio.nl – Hosting Plus pakket. cPanel beschikbaar.",
      startDate: new Date("2025-11-01"),
      dueDate: new Date("2026-04-15"),
      ownerUserId: devUser.id,
      tags: ["wordpress", "webshop", "woocommerce"],
    },
  });

  const project2 = await prisma.projectWorkspace.upsert({
    where: { slug: "duurzaam-nederland-redesign" },
    update: {},
    create: {
      id: "project-duurzaam-redesign",
      clientId: client2.id,
      name: "Duurzaam Nederland – Website Redesign",
      slug: "duurzaam-nederland-redesign",
      projectType: ProjectType.REDESIGN,
      status: ProjectStatus.WAITING_FOR_CLIENT,
      priority: ProjectPriority.MEDIUM,
      description: "Redesign van de bestaande website. Focus op betere SEO, modern design en betere donatiefunctionaliteit.",
      intakeSummary: "De huidige site is verouderd (2018) en niet mobielvriendelijk. Klant wil een fris design, betere structuur en een donatieknop die werkt met Mollie.",
      scope: "Nieuwe homepage, over ons, projecten, doneren pagina, nieuws/blog, contact. Niet: volledige CMS-training (aparte offerte).",
      techStack: "WordPress, GeneratePress, Mollie plugin",
      domainName: "duurzaamnederland.org",
      hostingInfo: "Antagonist – SSD Hosting. SFTP beschikbaar.",
      startDate: new Date("2026-01-15"),
      dueDate: new Date("2026-03-31"),
      ownerUserId: admin.id,
      tags: ["wordpress", "redesign", "non-profit"],
    },
  });

  const project3 = await prisma.projectWorkspace.upsert({
    where: { slug: "techstart-landing-page" },
    update: {},
    create: {
      id: "project-techstart-landing",
      clientId: client3.id,
      name: "TechStart – Launch Landing Page",
      slug: "techstart-landing-page",
      projectType: ProjectType.LANDING_PAGE,
      status: ProjectStatus.REVIEW,
      priority: ProjectPriority.URGENT,
      description: "Single-page landing site voor de product launch van TechStart's nieuwe fintech app. CTA-gericht, hoge conversie.",
      intakeSummary: "Klant lanceert hun MVP op 1 april. Landing page moet er professioneel uitzien met e-mail capture formulier (Mailchimp) en video embed.",
      scope: "1 pagina: hero, features, social proof, early access form, footer. Geen blog, geen aparte pagina's.",
      techStack: "Next.js, Tailwind CSS, Vercel, Mailchimp API",
      domainName: "app.techstart.io",
      hostingInfo: "Vercel – Pro plan. GitHub Actions voor CI/CD.",
      startDate: new Date("2026-02-15"),
      dueDate: new Date("2026-03-25"),
      ownerUserId: devUser.id,
      tags: ["nextjs", "landing-page", "fintech", "urgent"],
    },
  });

  const project4 = await prisma.projectWorkspace.upsert({
    where: { slug: "hotel-atlantis-maintenance" },
    update: {},
    create: {
      id: "project-atlantis-maintenance",
      clientId: client4.id,
      name: "Hotel Atlantis – Onderhoud & Updates",
      slug: "hotel-atlantis-maintenance",
      projectType: ProjectType.MAINTENANCE,
      status: ProjectStatus.MAINTENANCE,
      priority: ProjectPriority.LOW,
      description: "Maandelijks onderhoud en updates van de bestaande hotelwebsite. Plugin updates, content wijzigingen, performance monitoring.",
      scope: "Maandelijks: plugin updates, backup verificatie, performance check, max. 2 uur content wijzigingen.",
      techStack: "WordPress, Divi Builder",
      domainName: "hotelatlantis.nl",
      hostingInfo: "TransIP – BladeVPS X4. Plesk beschikbaar.",
      startDate: new Date("2024-06-01"),
      ownerUserId: devUser.id,
      tags: ["wordpress", "maintenance", "onderhoud"],
    },
  });

  console.log("✅ Projects created");

  // ─── Repositories ─────────────────────────────────────────────────────────
  await prisma.projectRepository.upsert({
    where: { id: "repo-techstart-landing" },
    update: {},
    create: {
      id: "repo-techstart-landing",
      projectId: project3.id,
      provider: "github",
      repoName: "agency-os/techstart-landing",
      repoUrl: "https://github.com/agency-os/techstart-landing",
      defaultBranch: "main",
      issueBoardUrl: "https://github.com/agency-os/techstart-landing/issues",
    },
  });

  await prisma.projectRepository.upsert({
    where: { id: "repo-bakkerij-jansen" },
    update: {},
    create: {
      id: "repo-bakkerij-jansen",
      projectId: project1.id,
      provider: "github",
      repoName: "agency-os/bakkerij-jansen",
      repoUrl: "https://github.com/agency-os/bakkerij-jansen",
      defaultBranch: "develop",
      issueBoardUrl: "https://github.com/agency-os/bakkerij-jansen/issues",
    },
  });

  console.log("✅ Repositories created");

  // ─── Communication entries ─────────────────────────────────────────────────
  const comm1 = await prisma.communicationEntry.create({
    data: {
      projectId: project1.id,
      authorUserId: admin.id,
      type: CommunicationType.EMAIL,
      subject: "Akkoord op ontwerp v2",
      content: `Van: Mark Jansen <mark@bakkerijjansen.nl>
Aan: ons@agency.nl

Goedemiddag,

Ik heb het tweede ontwerp bekeken en ik ben er erg blij mee! Het kleurschema past perfect bij onze huisstijl. De webshop pagina ziet er professioneel uit.

Een paar kleine puntjes:
- Kunnen we het logo iets groter maken in de header?
- De 'Bestel nu' knop mag wat meer opvallen, misschien oranje?
- Is het mogelijk om een 'dagaanbieding' blok op de homepage toe te voegen?

Voor de rest is het goedgekeurd. Wanneer gaan jullie beginnen met de ontwikkeling?

Met vriendelijke groet,
Mark Jansen
Bakkerij Jansen B.V.`,
      externalSenderName: "Mark Jansen",
      externalSenderEmail: "mark@bakkerijjansen.nl",
      isInternal: false,
      occurredAt: new Date("2026-02-10T14:30:00"),
    },
  });

  await prisma.communicationEntry.create({
    data: {
      projectId: project1.id,
      authorUserId: devUser.id,
      type: CommunicationType.CALL,
      subject: "Telefoongesprek: webshop categorie-indeling",
      content: `Gesprek met Mark Jansen (15 min).

Besproken:
- Webshop categorieën: Brood, Banket, Taarten, Seizoensproducten
- Klant wil 'Nieuw' label op nieuwe producten (max 14 dagen)
- Verzending: alleen PostNL, DHL later eventueel
- Bezorggebied: heel Nederland, ophalen ook mogelijk
- Betalingen: iDEAL verplicht, creditcard optioneel

Actiepunten:
- Sander maakt categorie-structuur klaar in WooCommerce
- Mark stuurt productenlijst met foto's (deadline: volgende week vrijdag)`,
      isInternal: false,
      occurredAt: new Date("2026-02-14T10:00:00"),
    },
  });

  const comm2 = await prisma.communicationEntry.create({
    data: {
      projectId: project2.id,
      authorUserId: admin.id,
      type: CommunicationType.EMAIL,
      subject: "Wachten op tekstmateriaal van klant",
      content: `Interne notitie:

Eva heeft beloofd de teksten voor de 'Over ons' en 'Projecten' pagina's voor 7 maart aan te leveren. We kunnen pas verder met de homepage pas als we weten welke projecten uitgelicht worden.

Reminder sturen als we voor maandag niets ontvangen hebben.`,
      isInternal: true,
      occurredAt: new Date("2026-03-01T09:00:00"),
    },
  });

  await prisma.communicationEntry.create({
    data: {
      projectId: project3.id,
      authorUserId: devUser.id,
      type: CommunicationType.EMAIL,
      subject: "Feedback op review link van klant",
      content: `Van: Robin de Vries <robin@techstart.io>
Aan: sander@agency.nl

Hey Sander,

De staging link ziet er geweldig uit! Een paar dingen:

1. De animaties op de features-sectie zijn te snel, kunnen die iets langzamer?
2. Op iPhone 13 is de hero-tekst te groot (overflow)
3. Het formulier werkt, maar kunnen we een loading state toevoegen bij de submit?

Launch datum staat nog steeds op 1 april. Zit je op schema?

Cheers,
Robin`,
      externalSenderName: "Robin de Vries",
      externalSenderEmail: "robin@techstart.io",
      isInternal: false,
      occurredAt: new Date("2026-03-10T16:45:00"),
    },
  });

  console.log("✅ Communication entries created");

  // ─── Change Requests ───────────────────────────────────────────────────────
  const cr1 = await prisma.changeRequest.create({
    data: {
      projectId: project1.id,
      title: "Logo groter maken in header",
      description: "Klant heeft gevraagd het logo in de header groter te maken. Momenteel is het 120px breed, klant wil minimaal 160px. Padding aanpassen zodat de header er niet te vol uitziet.",
      sourceType: ChangeRequestSource.EMAIL,
      status: ChangeRequestStatus.IN_PROGRESS,
      impact: ChangeRequestImpact.SMALL,
      createdByUserId: admin.id,
      assignedToUserId: devUser.id,
      communications: {
        connect: [{ id: comm1.id }],
      },
    },
  });

  const cr2 = await prisma.changeRequest.create({
    data: {
      projectId: project1.id,
      title: "'Dagaanbieding' blok toevoegen op homepage",
      description: `Klant wil een dynamisch 'Dagaanbieding' blok op de homepage. Het blok moet tonen:
- Productafbeelding
- Naam van het dagproduct
- Normale prijs doorgestreept
- Aanbiedingsprijs
- 'Bestel nu' knop

Dit is een WooCommerce product dat de klant zelf dagelijks instelt via een 'Featured' tag. Blok verdwijnt automatisch als er geen gefeatured product is.`,
      sourceType: ChangeRequestSource.EMAIL,
      status: ChangeRequestStatus.PLANNED,
      impact: ChangeRequestImpact.MEDIUM,
      createdByUserId: admin.id,
      assignedToUserId: devUser.id,
      communications: {
        connect: [{ id: comm1.id }],
      },
    },
  });

  const cr3 = await prisma.changeRequest.create({
    data: {
      projectId: project3.id,
      title: "Loading state toevoegen aan submit knop",
      description: "Na het indienen van het early access formulier moet de knop een loading state tonen. Momenteel geeft de knop geen visuele feedback. Implementeren met een spinner icon en disabled state.",
      sourceType: ChangeRequestSource.EMAIL,
      status: ChangeRequestStatus.NEW,
      impact: ChangeRequestImpact.SMALL,
      createdByUserId: devUser.id,
      assignedToUserId: devUser.id,
    },
  });

  const cr4 = await prisma.changeRequest.create({
    data: {
      projectId: project3.id,
      title: "Hero tekst overflow fix op iPhone",
      description: "Op iPhone 13 (375px viewport) is de hero heading te groot en loopt buiten het scherm. Moet getest worden op iPhone 12, 13, 14 en 15. Responsive font sizes aanpassen via clamp() of breakpoints.",
      sourceType: ChangeRequestSource.EMAIL,
      status: ChangeRequestStatus.IN_PROGRESS,
      impact: ChangeRequestImpact.MEDIUM,
      createdByUserId: devUser.id,
      assignedToUserId: devUser.id,
      githubBranch: "fix/hero-mobile-overflow",
    },
  });

  const cr5 = await prisma.changeRequest.create({
    data: {
      projectId: project2.id,
      title: "Mollie donatie integratie",
      description: "Integreer Mollie betalingen voor de donatieknop. Klant wil vaste bedragen (5, 10, 25 euro) plus een vrij in te vullen bedrag. Bedankpagina na succesvolle donatie.",
      sourceType: ChangeRequestSource.INTERNAL,
      status: ChangeRequestStatus.REVIEWED,
      impact: ChangeRequestImpact.LARGE,
      createdByUserId: admin.id,
    },
  });

  console.log("✅ Change requests created");

  // ─── Internal Notes ────────────────────────────────────────────────────────
  await prisma.internalNote.createMany({
    data: [
      {
        projectId: project1.id,
        authorUserId: devUser.id,
        content: "WooCommerce installatie klaar. Bezig met het opzetten van de categorie-structuur. Productenlijst van klant nog niet ontvangen.",
      },
      {
        projectId: project1.id,
        changeRequestId: cr2.id,
        authorUserId: devUser.id,
        content: "Featured product logica werkt via WooCommerce product tag 'dagaanbieding'. Query in functions.php, blok via shortcode. Template klaar, nog testen.",
      },
      {
        projectId: project2.id,
        authorUserId: admin.id,
        content: "Let op: Eva is moeilijk bereikbaar. Altijd schriftelijk communiceren voor de paper trail. Deadlines expliciet benoemen in elke mail.",
      },
      {
        projectId: project3.id,
        authorUserId: devUser.id,
        content: "Vercel deployment werkt. Branch preview URL's actief. GitHub Actions pipeline geeft groene status. Mailchimp API key staat in Vercel env vars.",
      },
    ],
  });

  console.log("✅ Internal notes created");

  // ─── Invoices ──────────────────────────────────────────────────────────────
  await prisma.invoice.create({
    data: {
      id: "invoice-001",
      clientId: client1.id,
      projectId: project1.id,
      invoiceNumber: "2026-001",
      issueDate: new Date("2026-01-15"),
      dueDate: new Date("2026-02-14"),
      status: InvoiceStatus.PAID,
      subtotal: 1500.00,
      vatRate: 21,
      vatAmount: 315.00,
      totalAmount: 1815.00,
      description: "Aanbetaling 50% – Bakkerij Jansen Nieuwe Website",
      paidAt: new Date("2026-02-10"),
    },
  });

  await prisma.invoice.create({
    data: {
      id: "invoice-002",
      clientId: client3.id,
      projectId: project3.id,
      invoiceNumber: "2026-002",
      issueDate: new Date("2026-02-15"),
      dueDate: new Date("2026-03-16"),
      status: InvoiceStatus.SENT,
      subtotal: 2400.00,
      vatRate: 21,
      vatAmount: 504.00,
      totalAmount: 2904.00,
      description: "TechStart Landing Page – Volledig bedrag",
      notes: "Betaling via Tikkie of bank. Robin bevestigd mondelinge toezegging.",
    },
  });

  await prisma.invoice.create({
    data: {
      id: "invoice-003",
      clientId: client4.id,
      projectId: project4.id,
      invoiceNumber: "2026-003",
      issueDate: new Date("2026-03-01"),
      dueDate: new Date("2026-03-15"),
      status: InvoiceStatus.OVERDUE,
      subtotal: 250.00,
      vatRate: 21,
      vatAmount: 52.50,
      totalAmount: 302.50,
      description: "Maandelijks onderhoud – Februari 2026",
    },
  });

  await prisma.invoice.create({
    data: {
      id: "invoice-004",
      clientId: client2.id,
      projectId: project2.id,
      invoiceNumber: "2026-004",
      issueDate: new Date("2026-03-10"),
      dueDate: new Date("2026-04-09"),
      status: InvoiceStatus.DRAFT,
      subtotal: 1800.00,
      vatRate: 21,
      vatAmount: 378.00,
      totalAmount: 2178.00,
      description: "Duurzaam Nederland Website Redesign – Eerste fase",
    },
  });

  console.log("✅ Invoices created");

  // ─── Audit Logs ───────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      {
        actorUserId: admin.id,
        entityType: "ProjectWorkspace",
        entityId: project1.id,
        action: "PROJECT_CREATED",
        metadataJson: { projectName: "Bakkerij Jansen – Nieuwe Website" },
      },
      {
        actorUserId: admin.id,
        entityType: "ProjectWorkspace",
        entityId: project1.id,
        action: "STATUS_CHANGED",
        metadataJson: { from: "INTAKE", to: "IN_PROGRESS" },
      },
      {
        actorUserId: devUser.id,
        entityType: "ChangeRequest",
        entityId: cr1.id,
        action: "CHANGE_REQUEST_CREATED",
        metadataJson: { title: "Logo groter maken in header", projectId: project1.id },
      },
      {
        actorUserId: devUser.id,
        entityType: "ProjectRepository",
        entityId: "repo-bakkerij-jansen",
        action: "REPOSITORY_LINKED",
        metadataJson: { repoUrl: "https://github.com/agency-os/bakkerij-jansen", projectId: project1.id },
      },
      {
        actorUserId: admin.id,
        entityType: "Invoice",
        entityId: "invoice-001",
        action: "INVOICE_MARKED_PAID",
        metadataJson: { invoiceNumber: "2026-001", amount: 1815.00 },
      },
    ],
  });

  console.log("✅ Audit logs created");
  console.log("\n🎉 Database seeded successfully!");
  console.log("\n📧 Login credentials:");
  console.log(`   Admin:    ${process.env.SEED_ADMIN_EMAIL ?? "admin@agency.nl"} / ${process.env.SEED_ADMIN_PASSWORD ?? "admin123!"}`);
  console.log("   Employee: dev@agency.nl / employee123!");
  console.log("   Finance:  finance@agency.nl / finance123!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
